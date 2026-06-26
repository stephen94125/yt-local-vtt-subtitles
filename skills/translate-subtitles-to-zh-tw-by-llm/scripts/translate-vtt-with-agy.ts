#!/usr/bin/env node
import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

type Cue = {
  index: number;
  blockIndex: number;
  prefixLines: string[];
  timingLine: string;
  text: string;
};

type Batch = {
  batchIndex: number;
  targetStart: number;
  targetEnd: number;
  contextStart: number;
  contextEnd: number;
  context: Cue[];
  target: Cue[];
};

type Options = {
  input: string;
  output: string;
  workdir: string;
  promptTemplate: string;
  chunkSize: number;
  overlap: number;
  model: string;
  timeoutMs: number;
  resume: boolean;
  agyBin: string;
  maxEnglishLineRatio: number;
};

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const defaultPromptTemplate = "../references/vtt-zh-tw-translation.md";
const defaultVideoId = "dQw4w9WgXcQ";
const defaultVttDir = "~/.vtt";

const defaults: Options = {
  input: `${defaultVttDir}/${defaultVideoId}.en.vtt`,
  output: `${defaultVttDir}/${defaultVideoId}.zh-TW.vtt`,
  workdir: `${defaultVttDir}/tmp/vtt-translation-${defaultVideoId}`,
  promptTemplate: defaultPromptTemplate,
  chunkSize: 400,
  overlap: 120,
  model: "gemini-3.5-flash",
  timeoutMs: 10 * 60 * 1000,
  resume: false,
  agyBin: "agy",
  maxEnglishLineRatio: 0.25,
};

function parseArgs(argv: string[]): Options {
  const opts = { ...defaults };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = () => {
      const value = argv[++i];
      if (!value) throw new Error(`Missing value for ${arg}`);
      return value;
    };

    switch (arg) {
      case "--input":
        opts.input = next();
        break;
      case "--output":
        opts.output = next();
        break;
      case "--workdir":
        opts.workdir = next();
        break;
      case "--prompt-template":
        opts.promptTemplate = next();
        break;
      case "--chunk-size":
        opts.chunkSize = Number(next());
        break;
      case "--overlap":
        opts.overlap = Number(next());
        break;
      case "--model":
        opts.model = next();
        break;
      case "--timeout-ms":
        opts.timeoutMs = Number(next());
        break;
      case "--agy-bin":
        opts.agyBin = next();
        break;
      case "--max-english-line-ratio":
        opts.maxEnglishLineRatio = Number(next());
        break;
      case "--resume":
        opts.resume = true;
        break;
      case "--help":
      case "-h":
        printHelp();
        process.exit(0);
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!Number.isInteger(opts.chunkSize) || opts.chunkSize <= 0) {
    throw new Error("--chunk-size must be a positive integer");
  }
  if (!Number.isInteger(opts.overlap) || opts.overlap < 0) {
    throw new Error("--overlap must be a non-negative integer");
  }
  if (!Number.isFinite(opts.timeoutMs) || opts.timeoutMs <= 0) {
    throw new Error("--timeout-ms must be a positive number");
  }
  if (!Number.isFinite(opts.maxEnglishLineRatio) || opts.maxEnglishLineRatio < 0) {
    throw new Error("--max-english-line-ratio must be a non-negative number");
  }

  opts.input = expandHomePath(opts.input);
  opts.output = expandHomePath(opts.output);
  opts.workdir = expandHomePath(opts.workdir);

  return opts;
}

function expandHomePath(value: string): string {
  if (value === "~") return homedir();
  if (value.startsWith("~/")) return path.join(homedir(), value.slice(2));
  return value;
}

function printHelp(): void {
  console.log(`Usage:
  node --experimental-strip-types scripts/translate-vtt-with-agy.ts [options]

Options:
  --input <path>             Source VTT. Default: ${defaults.input}
  --output <path>            Target VTT. Default: ${defaults.output}
  --workdir <path>           Batch artifacts. Default: ${defaults.workdir}
  --prompt-template <path>   Prompt template. Default: ${defaults.promptTemplate}
  --chunk-size <n>           Target cues per agy call. Default: ${defaults.chunkSize}
  --overlap <n>              Previous cues as context. Default: ${defaults.overlap}
  --model <name>             agy model. Default: ${defaults.model}
  --timeout-ms <n>           Timeout per agy call. Default: ${defaults.timeoutMs}
  --agy-bin <path>           agy executable. Default: ${defaults.agyBin}
  --max-english-line-ratio <n>
                              Fail when English-heavy text lines exceed this ratio. Default: ${defaults.maxEnglishLineRatio}
  --resume                   Reuse existing batch response files when present
`);
}

function parseVtt(raw: string): { headerBlock: string; blocks: string[]; cues: Cue[] } {
  const normalized = raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const blocks = normalized.trimEnd().split(/\n\s*\n/);
  const headerBlock = blocks[0] ?? "";
  const cues: Cue[] = [];

  for (let blockIndex = 1; blockIndex < blocks.length; blockIndex++) {
    const lines = blocks[blockIndex]!.split("\n");
    const timingIndex = lines.findIndex((line) => line.includes("-->"));
    if (timingIndex === -1) continue;

    cues.push({
      index: cues.length + 1,
      blockIndex,
      prefixLines: lines.slice(0, timingIndex),
      timingLine: lines[timingIndex]!,
      text: lines.slice(timingIndex + 1).join(" ").replace(/\s+/g, " ").trim(),
    });
  }

  return { headerBlock, blocks, cues };
}

function makeBatches(cues: Cue[], chunkSize: number, overlap: number): Batch[] {
  const batches: Batch[] = [];
  for (let start = 1; start <= cues.length; start += chunkSize) {
    const end = Math.min(cues.length, start + chunkSize - 1);
    const contextStart = Math.max(1, start - overlap);
    const contextEnd = start - 1;
    const context = cues.slice(contextStart - 1, contextEnd);
    const target = cues.slice(start - 1, end);
    batches.push({
      batchIndex: batches.length + 1,
      targetStart: start,
      targetEnd: end,
      contextStart,
      contextEnd,
      context,
      target,
    });
  }
  return batches;
}

function id(cue: Cue): string {
  return String(cue.index).padStart(4, "0");
}

function toTsv(cues: Cue[]): string {
  return cues.map((cue) => `${id(cue)}\t${cue.text.replace(/\t/g, " ")}`).join("\n");
}

function buildPrompt(template: string, batch: Batch): string {
  const contextText = batch.context.length > 0 ? toTsv(batch.context) : "（無）";
  return `${template.trim()}

前文參考，請只用來理解上下文，不要輸出：
${contextText}

目標字幕，請翻譯並只輸出這些 ID：
${toTsv(batch.target)}
`;
}

function resolvePromptTemplate(promptTemplate: string): string {
  if (path.isAbsolute(promptTemplate)) return promptTemplate;
  if (promptTemplate === defaultPromptTemplate) {
    return path.resolve(scriptDir, promptTemplate);
  }
  return promptTemplate;
}

async function runAgy(prompt: string, opts: Options): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), opts.timeoutMs);

  try {
    return await new Promise((resolve, reject) => {
      const child = spawn(opts.agyBin, ["--model", opts.model, "--print", "-"], {
        stdio: ["pipe", "pipe", "pipe"],
        signal: controller.signal,
      });

      let stdout = "";
      let stderr = "";
      child.stdout.setEncoding("utf8");
      child.stderr.setEncoding("utf8");
      child.stdout.on("data", (chunk) => {
        stdout += chunk;
      });
      child.stderr.on("data", (chunk) => {
        stderr += chunk;
      });
      child.on("error", (error) => {
        reject(error);
      });
      child.on("close", (code, signal) => {
        if (code === 0) {
          resolve(stdout.trim());
          return;
        }
        reject(new Error(`agy failed with code ${code ?? "null"} signal ${signal ?? "null"}\n${stderr}`));
      });
      child.stdin.end(prompt);
    });
  } finally {
    clearTimeout(timeout);
  }
}

function parseTranslations(raw: string, expected: Cue[]): Map<number, string> {
  const expectedIds = new Set(expected.map((cue) => id(cue)));
  const seen = new Set<string>();
  const duplicateIds = new Set<string>();
  const repairedIds = new Set<string>();
  const translations = new Map<number, string>();
  const lines = raw
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) => line.trimEnd())
    .filter((line) => line.trim() !== "" && !line.trim().startsWith("```"));

  for (const line of lines) {
    const tsvMatch = line.match(/^(\d{4})\t(.+)$/);
    const repairedMatch = line.match(/^(\d{4}):\s.*?\s->\s(.+)$/);
    const match = tsvMatch ?? repairedMatch;
    if (!match) {
      throw new Error(`Invalid TSV line: ${line}`);
    }
    const [, lineId, text] = match;
    if (!tsvMatch && repairedMatch) {
      repairedIds.add(lineId);
    }
    if (!expectedIds.has(lineId)) {
      throw new Error(`Unexpected cue id in output: ${lineId}`);
    }
    if (seen.has(lineId)) {
      duplicateIds.add(lineId);
    }
    seen.add(lineId);
    translations.set(Number(lineId), text.trim());
  }

  const missing = expected.filter((cue) => !seen.has(id(cue))).map((cue) => id(cue));
  if (missing.length > 0) {
    throw new Error(`Missing cue ids: ${missing.join(", ")}`);
  }
  if (duplicateIds.size > 0) {
    console.error(`Duplicate cue ids detected; kept last value: ${[...duplicateIds].join(", ")}`);
  }
  if (repairedIds.size > 0) {
    console.error(`Repaired non-TSV cue lines: ${[...repairedIds].join(", ")}`);
  }

  return translations;
}

async function readExistingTranslations(file: string, expected: Cue[]): Promise<Map<number, string> | null> {
  try {
    const raw = await readFile(file, "utf8");
    return parseTranslations(raw, expected);
  } catch {
    return null;
  }
}

function serializeTranslations(cues: Cue[], translations: Map<number, string>): string {
  return cues.map((cue) => `${id(cue)}\t${translations.get(cue.index) ?? ""}`).join("\n") + "\n";
}

function buildVtt(headerBlock: string, cues: Cue[], translations: Map<number, string>): string {
  const blocks = [headerBlock.replace(/^Language:.+$/m, "Language: zh-TW")];
  for (const cue of cues) {
    const text = translations.get(cue.index);
    if (!text) throw new Error(`Missing translation for cue ${id(cue)}`);
    const lines = [...cue.prefixLines, cue.timingLine, text].filter((line) => line !== "");
    blocks.push(lines.join("\n"));
  }
  return blocks.join("\n\n") + "\n";
}

function validateOutput(sourceRaw: string, outputRaw: string, cueCount: number, maxEnglishLineRatio: number): string[] {
  const problems: string[] = [];
  const sourceTimes = sourceRaw.match(/^.*-->.*$/gm) ?? [];
  const outputTimes = outputRaw.match(/^.*-->.*$/gm) ?? [];
  const outputBlocks = outputRaw.trimEnd().split(/\n\s*\n/);

  if (!outputRaw.startsWith("WEBVTT")) {
    problems.push("Output does not start with WEBVTT");
  }
  if (sourceTimes.length !== cueCount) {
    problems.push(`Source timing count mismatch: ${sourceTimes.length} != ${cueCount}`);
  }
  if (outputTimes.length !== cueCount) {
    problems.push(`Output timing count mismatch: ${outputTimes.length} != ${cueCount}`);
  }
  if (sourceTimes.length === outputTimes.length) {
    for (let i = 0; i < sourceTimes.length; i++) {
      if (sourceTimes[i] !== outputTimes[i]) {
        problems.push(`Timing mismatch at cue ${String(i + 1).padStart(4, "0")}`);
        break;
      }
    }
  }
  if (outputBlocks.length !== cueCount + 1) {
    problems.push(`Output block count mismatch: ${outputBlocks.length} != ${cueCount + 1}`);
  }

  const englishLineCount = outputRaw
    .split("\n")
    .filter((line) =>
      /[A-Za-z]{4,}/.test(line) &&
      !line.includes("-->") &&
      !line.startsWith("WEBVTT") &&
      !line.startsWith("Kind:") &&
      !line.startsWith("Language:")
    ).length;
  if (englishLineCount > Math.ceil(cueCount * maxEnglishLineRatio)) {
    problems.push(`Suspicious English-heavy output lines: ${englishLineCount}`);
  }

  return problems;
}

async function main(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2));
  const promptTemplatePath = resolvePromptTemplate(opts.promptTemplate);
  const [sourceRaw, template] = await Promise.all([
    readFile(opts.input, "utf8"),
    readFile(promptTemplatePath, "utf8"),
  ]);
  const parsed = parseVtt(sourceRaw);
  const batches = makeBatches(parsed.cues, opts.chunkSize, opts.overlap);
  const promptDir = path.join(opts.workdir, "prompts");
  const responseDir = path.join(opts.workdir, "responses");
  await mkdir(path.dirname(opts.output), { recursive: true });
  await mkdir(promptDir, { recursive: true });
  await mkdir(responseDir, { recursive: true });

  const translations = new Map<number, string>();
  await writeFile(path.join(opts.workdir, "source.tsv"), serializeTranslations(parsed.cues, new Map(parsed.cues.map((cue) => [cue.index, cue.text]))));

  for (const batch of batches) {
    const label = String(batch.batchIndex).padStart(3, "0");
    const promptFile = path.join(promptDir, `batch-${label}-${id(batch.target[0]!)}-${id(batch.target.at(-1)!)}.md`);
    const responseFile = path.join(responseDir, `batch-${label}-${id(batch.target[0]!)}-${id(batch.target.at(-1)!)}.tsv`);
    const prompt = buildPrompt(template, batch);
    await writeFile(promptFile, prompt);

    let batchTranslations: Map<number, string> | null = null;
    if (opts.resume) {
      batchTranslations = await readExistingTranslations(responseFile, batch.target);
    }

    if (!batchTranslations) {
      console.error(`Translating batch ${label}: ${id(batch.target[0]!)}-${id(batch.target.at(-1)!)} (${batch.target.length} cues)`);
      const raw = await runAgy(prompt, opts);
      await writeFile(responseFile, raw.trim() + "\n");
      batchTranslations = parseTranslations(raw, batch.target);
    } else {
      console.error(`Reusing batch ${label}: ${id(batch.target[0]!)}-${id(batch.target.at(-1)!)}`);
    }

    for (const [cueId, text] of batchTranslations) {
      translations.set(cueId, text);
    }
    await writeFile(path.join(opts.workdir, "translations.tsv"), serializeTranslations(parsed.cues, translations));
  }

  const missing = parsed.cues.filter((cue) => !translations.has(cue.index)).map((cue) => id(cue));
  if (missing.length > 0) {
    throw new Error(`Missing translations after all batches: ${missing.join(", ")}`);
  }

  const outputRaw = buildVtt(parsed.headerBlock, parsed.cues, translations);
  const problems = validateOutput(sourceRaw, outputRaw, parsed.cues.length, opts.maxEnglishLineRatio);
  if (problems.length > 0) {
    throw new Error(`Validation failed:\n${problems.join("\n")}`);
  }

  await writeFile(opts.output, outputRaw);
  await writeFile(path.join(opts.workdir, "validation.txt"), `ok\ncues=${parsed.cues.length}\nbatches=${batches.length}\n`);
  console.error(`Wrote ${opts.output}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
