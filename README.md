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
