---
name: translate-subtitles-to-zh-tw-by-llm
description: YouTube VTT 字幕下載與繁體中文翻譯流程。當使用者提供 YouTube 網址或 videoId，要求下載官方或自動產生字幕、避開 YouTube 自動翻譯字幕，並產出 `{videoId}.zh-TW.vtt` 可供本機 YouTube 字幕 extension 使用時使用。此 skill 指導代理確認 videoId、選擇可用字幕、下載 VTT、用 bundled `scripts/translate-vtt-with-agy.ts` 翻譯、續跑與驗證。
---

# YouTube VTT 繁中字幕流程

此 skill 用於把 YouTube 影片的可用字幕整理成本機可用的繁體中文 VTT。目標輸出檔名必須是：

```text
{videoId}.zh-TW.vtt
```

下載的來源字幕與翻譯完成的字幕必須放在使用者家目錄底下的 `.vtt/`：

```text
$HOME/.vtt/{videoId}.{sourceLang}.vtt
$HOME/.vtt/{videoId}.zh-TW.vtt
```

暫存檔必須放在：

```text
$HOME/.vtt/tmp/
```

開始下載或翻譯前，若目錄不存在，代理必須建立：

```bash
mkdir -p "$HOME/.vtt" "$HOME/.vtt/tmp"
```

## 輸入要求

代理必須先確認任務有可用的 `videoId`。

可接受輸入：

- YouTube watch URL，例如 `https://www.youtube.com/watch?v=l6rvOO9HktY&t=1186s`
- YouTube short URL，例如 `https://youtu.be/l6rvOO9HktY`
- 直接提供 videoId，例如 `l6rvOO9HktY`

如果無法從輸入取得 videoId，代理必須停止並要求使用者提供 YouTube URL 或 videoId。

## 核心流程

本節的預設執行者是代理。

### 1. 確認 videoId

從 URL 或使用者輸入抽出 videoId。忽略 `t=`、`list=` 等不影響字幕下載的查詢參數。

範例：

```text
https://www.youtube.com/watch?v=l6rvOO9HktY&t=1186s
```

videoId 是：

```text
l6rvOO9HktY
```

### 2. 檢查可用字幕

使用 `yt-dlp` 查詢字幕資訊。

建議先用 JSON 查詢：

```bash
yt-dlp --no-update --no-warnings -J "YOUTUBE_URL"
```

選字幕時必須遵守：

- 代理必須優先選擇 YouTube 影片本身提供的官方字幕。
- 若沒有官方字幕，代理可以選擇 YouTube 自動產生字幕。
- 代理不得下載 YouTube 自動翻譯字幕。
- 代理必須略過「Chinese (Traditional) from Japanese」、「Chinese (Traditional) from English」這類由 YouTube 翻譯來源字幕產生的字幕。
- 代理不得把 `tlang=zh-Hant`、`tlang=zh-TW`、`tlang=zh` 這類翻譯字幕當作可用來源。

實務判斷：

- `subtitles` 通常是官方字幕。
- `automatic_captions` 通常是自動產生字幕與自動翻譯字幕混在一起。
- 若字幕 URL 或 metadata 出現 `tlang=`，通常是 YouTube 自動翻譯字幕，必須略過。
- 若字幕名稱包含 `from English`、`from Japanese`、`from Korean` 等，必須略過。

### 3. 遇到沒有可用字幕時停止

如果沒有任何官方字幕，也沒有任何可用的自動產生字幕，代理必須停止。

停止時回報：

- videoId
- 已檢查的字幕來源
- 為什麼沒有可用字幕
- 沒有產生任何 `{videoId}.zh-TW.vtt`

### 4. 如果已有中文官方或自動產生字幕

如果影片已經有直接可用的中文字幕，包含簡體或繁體，代理應直接下載該字幕。

可接受：

- 官方繁體中文字幕
- 官方簡體中文字幕
- 自動產生的中文原始字幕

不可接受：

- `Chinese (Traditional) from English`
- `Chinese (Traditional) from Japanese`
- `Chinese (Traditional) from Korean`
- 任何 YouTube 自動翻譯產生的中文字幕

下載後：

- 目標檔名仍必須是 `$HOME/.vtt/{videoId}.zh-TW.vtt`。
- 如果下載的是簡體中文，除非使用者要求，代理可以先回報「已有簡體中文字幕」；需要繁化時再轉成繁體。
- 代理必須回報使用者「影片已有直接可用中文字幕」，並說明是否仍有翻譯步驟。

### 5. 下載英文或其他可用來源字幕

若沒有直接可用中文字幕，選擇一個可用來源字幕下載。通常優先順序：

1. 官方英文字幕。
2. 官方韓文、日文或其他原語字幕。
3. 自動產生的英文字幕。
4. 自動產生的原語字幕。

使用 README 中相同模式下載 VTT：

```bash
yt-dlp --no-update \
  --skip-download \
  --write-subs \
  --sub-langs "LANG_CODE" \
  --sub-format vtt \
  -o "$HOME/.vtt/%(id)s.%(ext)s" \
  "YOUTUBE_URL"
```

如果下載的是 `en-US`，yt-dlp 可能輸出：

```text
$HOME/.vtt/{videoId}.en-US.vtt
```

為了讓後續翻譯流程穩定，代理應複製或整理成：

```text
$HOME/.vtt/{videoId}.en.vtt
```

### 6. 用翻譯腳本產出繁中 VTT

使用此 skill 內建腳本：

```text
scripts/translate-vtt-with-agy.ts
```

推薦命令：

```bash
node --experimental-strip-types scripts/translate-vtt-with-agy.ts \
  --input "$HOME/.vtt/{videoId}.en.vtt" \
  --output "$HOME/.vtt/{videoId}.zh-TW.vtt" \
  --workdir "$HOME/.vtt/tmp/vtt-translation-{videoId}" \
  --chunk-size 400 \
  --overlap 120 \
  --model gemini-3.5-flash \
  --timeout-ms 900000
```

如果來源不是英文，仍可使用同一腳本，但 `--input` 應指向實際下載的來源 VTT。代理應在回報中說明來源語言。

## 翻譯腳本實用法

### 腳本用途

`translate-vtt-with-agy.ts` 會：

1. 解析來源 VTT。
2. 抽出 cue 文字成 TSV。
3. 依 batch 切分目標 cue。
4. 附帶前文 overlap 作為上下文。
5. 用 `agy --model MODEL --print -` 呼叫模型。
6. 解析模型回傳 TSV。
7. 合併回 VTT。
8. 驗證時間碼與 VTT 結構。

模型只處理字幕文字。時間碼、VTT header 與 cue block 由腳本保留。

### 常用命令

第一次跑：

```bash
node --experimental-strip-types scripts/translate-vtt-with-agy.ts \
  --input "$HOME/.vtt/{videoId}.en.vtt" \
  --output "$HOME/.vtt/{videoId}.zh-TW.vtt" \
  --workdir "$HOME/.vtt/tmp/vtt-translation-{videoId}" \
  --chunk-size 400 \
  --overlap 120 \
  --model gemini-3.5-flash \
  --timeout-ms 900000
```

續跑：

```bash
node --experimental-strip-types scripts/translate-vtt-with-agy.ts \
  --input "$HOME/.vtt/{videoId}.en.vtt" \
  --output "$HOME/.vtt/{videoId}.zh-TW.vtt" \
  --workdir "$HOME/.vtt/tmp/vtt-translation-{videoId}" \
  --chunk-size 400 \
  --overlap 120 \
  --model gemini-3.5-flash \
  --timeout-ms 900000 \
  --resume
```

如果影片含大量英文歌名、藝人名、樂團名、專輯名、音樂類型或英文歌詞片段，英文殘留檢查可能過嚴。此時可以放寬比例：

```bash
node --experimental-strip-types scripts/translate-vtt-with-agy.ts \
  --input "$HOME/.vtt/{videoId}.en.vtt" \
  --output "$HOME/.vtt/{videoId}.zh-TW.vtt" \
  --workdir "$HOME/.vtt/tmp/vtt-translation-{videoId}" \
  --chunk-size 400 \
  --overlap 120 \
  --model gemini-3.5-flash \
  --timeout-ms 900000 \
  --max-english-line-ratio 0.5 \
  --resume
```

代理不得只因英文殘留檢查失敗就直接放寬。代理必須先檢查 `responses/batch-*.tsv`，確認英文主要是合理保留的專名、歌名、品牌、縮寫或音樂類型。

### 參數說明

| 參數 | 用途 |
|---|---|
| `--input` | 來源 VTT。常見是 `$HOME/.vtt/{videoId}.en.vtt`。 |
| `--output` | 目標 VTT。必須使用 `$HOME/.vtt/{videoId}.zh-TW.vtt`。 |
| `--workdir` | 中間檔目錄。建議使用 `$HOME/.vtt/tmp/vtt-translation-{videoId}`。 |
| `--prompt-template` | 翻譯提示詞。預設是腳本相對路徑 `../references/vtt-zh-tw-translation.md`。 |
| `--chunk-size` | 每批送給模型的目標 cue 數。預設 400。若模型漏行，降到 200 或 300。 |
| `--overlap` | 每批附帶前文 cue 數。預設 120。訪談類建議至少 120。 |
| `--model` | 傳給 agy 的模型名稱。預設 `gemini-3.5-flash`。 |
| `--timeout-ms` | 每次 agy 呼叫 timeout。大型 batch 建議 900000。 |
| `--agy-bin` | agy 執行檔路徑。只有找不到 `agy` 時才需要指定。 |
| `--max-english-line-ratio` | 英文殘留行比例門檻。預設 0.25。只有確認合理英文保留時才放寬。 |
| `--resume` | 重用已完成 batch response，從失敗處繼續。 |

### workdir 內容

`--workdir` 會包含：

```text
$HOME/.vtt/tmp/vtt-translation-{videoId}/
  prompts/          每批送給 agy 的 prompt
  responses/        agy 回傳的 raw TSV
  source.tsv        來源 cue TSV
  translations.tsv  已合併翻譯 TSV
  validation.txt    驗證結果
```

如果模型漏 ID、重複 ID 或輸出非 TSV，代理應先檢查：

```text
$HOME/.vtt/tmp/vtt-translation-{videoId}/responses/batch-*.tsv
$HOME/.vtt/tmp/vtt-translation-{videoId}/source.tsv
```

### 常見失敗處理

#### agy 要求重新登入

如果 response 出現：

```text
Authentication required. Please visit the URL to log in:
```

代理必須要求使用者完成登入。使用者完成後，代理應用 `--resume` 繼續。

#### 模型漏 ID

如果腳本回報：

```text
Missing cue ids: 1002, 1058
```

處理方式：

1. 對照 `source.tsv` 找出漏掉的原文。
2. 檢查 response 是否把漏掉 cue 併到前後 cue。
3. 若能明確修正，代理可以局部修正該 batch response。
4. 修正後用 `--resume` 續跑。
5. 若無法明確修正，代理應刪除該 batch response，讓腳本重跑該批。

代理不得在無法對照來源時猜測漏掉 cue 的翻譯。

#### 英文殘留檢查失敗

如果腳本回報：

```text
Suspicious English-heavy output lines
```

代理必須先檢查 raw TSV。若英文主要是合理保留的歌名、人名、團名、品牌、節目名、縮寫或音樂類型，代理可以用 `--max-english-line-ratio 0.5 --resume` 重新合併。

若英文包含完整未翻譯句子，代理不得放寬門檻；應重跑或修正該 batch。

## 驗證方式

完成後，代理必須執行獨立驗證。

建議命令：

```bash
node - <<'NODE'
const fs = require('fs');
const videoId = 'VIDEO_ID';
const base = `${process.env.HOME}/.vtt`;
const src = fs.readFileSync(`${base}/${videoId}.en.vtt`, 'utf8');
const out = fs.readFileSync(`${base}/${videoId}.zh-TW.vtt`, 'utf8');
const times = s => s.match(/^.*-->.*$/gm) || [];
const a = times(src), b = times(out);
console.log(`source timings=${a.length}`);
console.log(`target timings=${b.length}`);
console.log(`timings identical=${a.length === b.length && a.every((x, i) => x === b[i])}`);
console.log(`target blocks=${out.trimEnd().split(/\n\s*\n/).length}`);
console.log(`starts WEBVTT=${out.startsWith('WEBVTT')}`);
NODE
```

若來源不是 `en.vtt`，代理必須把驗證命令中的來源檔改成實際來源。

驗證必須滿足：

- `source timings` 等於 `target timings`。
- `timings identical=true`。
- `starts WEBVTT=true`。
- `target blocks` 等於 cue 數加 1。
- `$HOME/.vtt/tmp/vtt-translation-{videoId}/validation.txt` 包含 `ok`。

## 輸出契約

完成時，代理必須回報：

- videoId。
- 下載的來源字幕檔路徑。
- 最終字幕檔路徑 `$HOME/.vtt/{videoId}.zh-TW.vtt`。
- 使用的是官方字幕、自動產生字幕，或直接可用中文字幕。
- 是否使用翻譯腳本。
- 驗證結果摘要。
- 若有放寬英文殘留門檻，必須說明原因。

代理不得回報不存在的檔案。
代理不得把 YouTube 自動翻譯字幕稱為官方或自動產生原始字幕。

## 停止條件

代理必須在以下任一情況停止：

- 無法取得 videoId。
- 沒有任何官方或自動產生字幕可用。
- 只有 YouTube 自動翻譯字幕可用。
- 字幕下載失敗且重試後仍失敗。
- 翻譯腳本失敗且無法安全修正。
- 驗證未通過。
- 已成功產出並驗證 `$HOME/.vtt/{videoId}.zh-TW.vtt`。
