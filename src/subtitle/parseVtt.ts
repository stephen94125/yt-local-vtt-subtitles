import type { Cue } from "./cue";

const TIMESTAMP_LINE =
  /^(\d{2}:\d{2}:\d{2}\.\d{3}|\d{2}:\d{2}\.\d{3})\s+-->\s+(\d{2}:\d{2}:\d{2}\.\d{3}|\d{2}:\d{2}\.\d{3})(?:\s+.*)?$/;

export function parseTimestamp(input: string): number {
  const parts = input.split(":");

  if (parts.length === 2) {
    const [minutes, seconds] = parts;
    return Number(minutes) * 60 + Number(seconds);
  }

  if (parts.length === 3) {
    const [hours, minutes, seconds] = parts;
    return Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds);
  }

  return Number.NaN;
}

export function parseVtt(text: string): Cue[] {
  const normalized = text.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  const lines = normalized.split("\n");
  let index = 0;

  if (lines[index]?.startsWith("WEBVTT")) {
    index += 1;
  }

  const cues: Cue[] = [];

  while (index < lines.length) {
    while (index < lines.length && lines[index]?.trim() === "") index += 1;
    if (index >= lines.length) break;

    const line = lines[index]?.trim() ?? "";

    if (isBlockDirective(line)) {
      index = skipBlock(lines, index + 1);
      continue;
    }

    let timestampLine = line;
    if (!TIMESTAMP_LINE.test(timestampLine)) {
      index += 1;
      timestampLine = lines[index]?.trim() ?? "";
    }

    const match = timestampLine.match(TIMESTAMP_LINE);
    if (!match) {
      index = skipBlock(lines, index + 1);
      continue;
    }

    const start = parseTimestamp(match[1] ?? "");
    const end = parseTimestamp(match[2] ?? "");
    index += 1;

    const cueLines: string[] = [];
    while (index < lines.length && lines[index]?.trim() !== "") {
      cueLines.push(lines[index] ?? "");
      index += 1;
    }

    const textValue = cueLines.join("\n").trim();
    if (Number.isFinite(start) && Number.isFinite(end) && end >= start && textValue) {
      cues.push({ start, end, text: textValue });
    }
  }

  return cues.sort((a, b) => a.start - b.start || a.end - b.end);
}

function isBlockDirective(line: string): boolean {
  return line === "NOTE" || line.startsWith("NOTE ") || line === "STYLE" || line === "REGION";
}

function skipBlock(lines: string[], startIndex: number): number {
  let index = startIndex;
  while (index < lines.length && lines[index]?.trim() !== "") {
    index += 1;
  }
  return index;
}
