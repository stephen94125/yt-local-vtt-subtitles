# yt-local-vtt-subtitles

這是一個 Chrome extension，用來在 YouTube 影片上顯示本機 WebVTT 字幕檔。

## 本機建置

在專案根目錄執行：

```bash
npm install
npm run build
```

建置完成後，Chrome/Brave 可載入的 extension 資料夾是：

```text
/Users/stephen/Workspaces/045-yt-local-vtt-subtitles/.output/chrome-mv3
```

## 安裝到 Chrome/Brave

1. 打開 Chrome 或 Brave。
2. 進入 extension 管理頁：

```text
chrome://extensions
```

Brave 也可以用：

```text
brave://extensions
```

3. 右上角打開「開發人員模式」。
4. 點「載入未封裝項目」。
5. 選這個資料夾：

```text
/Users/stephen/Workspaces/045-yt-local-vtt-subtitles/.output/chrome-mv3
```

## 設定字幕資料夾

1. 在 Chrome extension 列點這個 extension。
2. 點 `Open options`。
3. 點 `Choose subtitle folder`。
4. 選一個放 `.vtt` 字幕檔的本機資料夾。

## 準備測試字幕檔

找一支 YouTube 影片，例如：

```text
https://www.youtube.com/watch?v=dQw4w9WgXcQ
```

那字幕檔名必須剛好是：

```text
dQw4w9WgXcQ.zh-TW.vtt
```

內容可以先用這個測試：

```vtt
WEBVTT

00:00:01.000 --> 00:00:03.500
第一句本機字幕

00:00:04.000 --> 00:00:06.250
第二句本機字幕
```

把它放進剛剛選的字幕資料夾。

## 用 yt-dlp 下載原生字幕

先查看影片有哪些原生字幕語言：

```bash
yt-dlp --no-update --no-warnings -J "https://www.youtube.com/watch?v=dQw4w9WgXcQ" \
  | jq -r '.subtitles | keys[]'
```

下載指定語言的 VTT 字幕，例如英文字幕：

```bash
yt-dlp --no-update \
  --skip-download \
  --write-subs \
  --sub-langs "en" \
  --sub-format vtt \
  "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
```

下載後請把輸出的檔名改成 extension v1 支援的固定格式：

```text
{videoId}.zh-TW.vtt
```

## 用 agy 翻譯 VTT 字幕

專案提供一支批次翻譯腳本：

```text
scripts/translate-vtt-with-agy.ts
```

它會把來源 VTT 拆成 TSV cue，送到 `agy` 翻成繁體中文，再合回新的 VTT。腳本只讓模型處理字幕文字，不讓模型碰時間碼和 VTT 結構。

### 前置條件

需要有：

- Node.js 24 以上，因為這裡用 `node --experimental-strip-types` 直接跑 TypeScript。
- `agy` CLI，且可以用 `--print` 非互動模式輸出結果。
- `prompts/vtt-zh-tw-translation.md`，這是翻譯提示詞模板。

先確認 `agy` 可用：

```bash
agy --model gemini-3.5-flash --print - <<'EOF'
請只輸出 OK
EOF
```

### 推薦用法

不要只靠預設值，建議明確指定 input、output 和 workdir：

```bash
node --experimental-strip-types scripts/translate-vtt-with-agy.ts \
  --input vtt/dQw4w9WgXcQ.en.vtt \
  --output vtt/dQw4w9WgXcQ.zh-TW.vtt \
  --workdir .tmp/vtt-translation-dQw4w9WgXcQ \
  --chunk-size 400 \
  --overlap 120 \
  --model gemini-3.5-flash \
  --timeout-ms 900000
```

輸出成功後，目標 VTT 會寫到 `--output` 指定的位置。

### 續跑

如果中途某一批失敗，已完成的 batch response 會留在 `--workdir` 底下。修正問題後可以加 `--resume`，重用已經通過解析的批次：

```bash
node --experimental-strip-types scripts/translate-vtt-with-agy.ts \
  --input vtt/dQw4w9WgXcQ.en.vtt \
  --output vtt/dQw4w9WgXcQ.zh-TW.vtt \
  --workdir .tmp/vtt-translation-dQw4w9WgXcQ \
  --chunk-size 400 \
  --overlap 120 \
  --model gemini-3.5-flash \
  --timeout-ms 900000 \
  --resume
```

### Flags

| flag | 預設值 | 說明 |
|---|---:|---|
| `--input <path>` | `vtt/dQw4w9WgXcQ.en.vtt` | 來源英文 VTT。 |
| `--output <path>` | `vtt/dQw4w9WgXcQ.zh-TW.vtt` | 輸出的繁中 VTT。 |
| `--workdir <path>` | `.tmp/vtt-translation-dQw4w9WgXcQ` | 中間檔目錄，會放 prompt、response、TSV 和驗證結果。建議每支影片用不同目錄。 |
| `--prompt-template <path>` | `prompts/vtt-zh-tw-translation.md` | 翻譯提示詞模板。 |
| `--chunk-size <n>` | `400` | 每次送給 `agy` 的目標 cue 數。數字越大，上下文越集中，但單次輸出越長。 |
| `--overlap <n>` | `120` | 每批前面附帶多少 cue 當前文參考。這些 cue 只給模型理解上下文，不會要求輸出。 |
| `--model <name>` | `gemini-3.5-flash` | 傳給 `agy --model` 的模型名稱。 |
| `--timeout-ms <n>` | `600000` | 每次 `agy` 呼叫的 timeout，單位是毫秒。大型 batch 建議用 `900000` 或更高。 |
| `--agy-bin <path>` | `agy` | `agy` 執行檔路徑。若 shell 找不到 agy，可直接指定完整路徑。 |
| `--resume` | 關閉 | 續跑模式。若 response 檔已存在且能解析，就重用該批結果。 |

### 工作目錄內容

`--workdir` 裡會產生：

```text
.tmp/vtt-translation-dQw4w9WgXcQ/
  prompts/          每一批送給 agy 的完整 prompt
  responses/        agy 回傳的 raw TSV
  source.tsv        從來源 VTT 抽出的原文 cue
  translations.tsv  已合併的翻譯 TSV
  validation.txt    最終驗證結果
```

如果某一批翻譯品質不好，可以先看對應的 `prompts/batch-...md` 和 `responses/batch-...tsv`。

### 腳本做的驗證

腳本會在寫出目標 VTT 前檢查：

- 每一批輸出都有完整目標 ID。
- 不接受目標範圍外的 ID。
- 重複 ID 會警告，並保留最後一版。
- `0001: English -> 中文` 這類非標準 TSV 會嘗試修復並警告。
- 來源與輸出的時間碼行數一致。
- 來源與輸出的每一行時間碼完全一致。
- 輸出 VTT 以 `WEBVTT` 開頭。
- VTT block 數等於 cue 數加 1 個 header block。
- 英文殘留行數過多時會失敗。

### 注意事項

- `vtt/*` 目前被 `.gitignore` 忽略，所以產出的 `.vtt` 會留在本機，不會自動進 git。
- 若要給 YouTube extension 使用，輸出檔名建議用 `{videoId}.zh-TW.vtt`。
- `--overlap` 可以開大一點，因為這個任務更重視上下文連貫；目前建議至少 `120`。
- `--chunk-size` 如果太大，模型比較可能漏行或輸出格式飄掉；如果常失敗，就降到 `200` 或 `300`。
- 機械驗證只能保證格式沒壞；語氣、笑點和台灣字幕感仍要依照 `docs/vtt-subtitle-translation-qa.md` 抽樣審稿。

## 測試流程

1. 打開 YouTube watch 頁。
2. 確認 YouTube 原生字幕是關閉的。
3. 點 extension popup。
4. 看狀態：
   - `Current videoId` 應該顯示影片 ID。
   - `Folder configured` 應該是 `yes`。
   - `Last subtitle status` 應該最後變成 `found`。
5. 影片播放到 VTT 對應時間時，播放器內應該出現本機字幕 overlay。
6. 打開 YouTube 原生字幕，再按 popup 的 `Reload subtitle`，狀態應該變成 `youtube captions on`，本機字幕不會自動顯示。
7. 切換到另一支影片，舊字幕應該消失。

## 開發時快速測試

改程式後跑：

```bash
npm run typecheck
npm run build
```

然後回到 `chrome://extensions` 或 `brave://extensions`，對這個 extension 點重新整理，再重整 YouTube 頁面。

## Troubleshooting

### Last subtitle status 顯示 no permission

`Folder configured: yes` 只代表 extension 記得你選過資料夾；讀取權限可能仍然被瀏覽器收回或變成需要重新確認。

先這樣試：

1. 點 `Open options`。
2. 在 options 頁按 `Re-authorize`。
3. 如果沒反應，就按 `Choose subtitle folder` 重新選一次資料夾。
4. 回 YouTube popup 按 `Reload subtitle`。

### File System Access API unavailable

如果在 Chrome/Brave 的 options page 按 `Choose subtitle folder`，但狀態顯示：

```text
File System Access API unavailable
```

這代表目前這個瀏覽器頁面沒有暴露 `showDirectoryPicker()`。Chrome/Brave 都可能遇到，差別通常是版本與預設 flag 有沒有打開。

先走這條排查路徑：

1. Chrome 打開 `chrome://flags`；Brave 打開 `brave://flags`。
2. 搜尋 `File System Access API`。
3. 把它從 `Default (Disabled)` 改成 `Enabled`。
4. 重啟瀏覽器。
5. 回到 `chrome://extensions` 或 `brave://extensions`。
6. 重新載入 extension。
7. 再打開 options，按 `Choose subtitle folder`。

如果還是 unavailable，先換另一個 Chromium 版本測，確認是瀏覽器支援/flag 問題，還是 extension 本身的問題。
