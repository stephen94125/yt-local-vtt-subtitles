# 參考專案分析

## `youtube-multi` 可借鏡的部分

- 找 YouTube 播放器時，`#movie_player` 是相對穩定的入口；實際的媒體元素通常在 `#movie_player video` 底下。
- YouTube 內部播放器物件可能透過 `getPlayerResponse()`、`getVideoData()` 等方法提供有用資料，但這些都不是正式 API，只能當作備援。
- YouTube 換影片時不一定會重新載入整個頁面，所以 video id 改變時必須清掉上一支影片的狀態。
- 字幕解析和 cue 顯示是可以拆開的責任；本專案應該讓 VTT 解析獨立於 YouTube DOM 控制流程。

## `youtube-subtitle-translator` 可借鏡的部分

- 只靠 content script 和 DOM API 的輕量做法，就足以處理播放器 overlay。
- 掛載 overlay 前先等待 `.html5-video-player` 或 `#movie_player` 出現，可以避免 `document_idle` 時播放器尚未就緒造成失敗。
- 自訂 overlay 可以直接放進 YouTube 播放器內，搭配 `position: absolute`、高 `z-index` 和 `pointer-events: none`。
- 監聽 DOM mutation 或導覽事件有參考價值，但 v1 用簡單的 URL 變化偵測會更容易理解和維護。

## 不應該照搬的部分

- 不複製 `youtube-multi` 的 Preact、Zustand、多字幕軌狀態、YouTube 選單整合，以及 `TextTrack`/`VTTCue` 顯示路徑。
- 不複製 `youtube-subtitle-translator` 的 Google Translate 呼叫、對 `.ytp-caption-segment` 的依賴，以及需要 YouTube 原生字幕先存在的處理流程。
- v1 不把自訂控制按鈕插進 YouTube 播放器 UI；控制功能放在 extension popup。

## 預期脆弱的 YouTube DOM 點

- `#movie_player`、`.html5-video-player` 和 `.ytp-subtitles-button` 都不是 YouTube 保證穩定的正式 API。
- content script 第一次執行時，`video` 元素和字幕按鈕可能還不存在。
- YouTube SPA 導覽可能替換播放器 DOM；如果清理不完整，舊 overlay 或 animation loop 可能會殘留。
- 播放器切換狀態時，字幕按鈕的 `aria-pressed` 和 active CSS class 可能短暫不同步。

## 本專案採用的實作方式

在 repo root 建立全新的 WXT + TypeScript MV3 extension。Options page 讓使用者選擇本機字幕資料夾，並把 `FileSystemDirectoryHandle` 存到 IndexedDB。Content script 偵測 YouTube watch 頁面的 video id，確認 YouTube 原生字幕目前是關閉狀態後，向 background script 請求 `{videoId}.zh-TW.vtt`，在本機解析 WebVTT，將自訂 overlay 掛到播放器內，並用 `requestAnimationFrame` 迴圈根據 `video.currentTime` 同步字幕顯示。缺檔、權限不足或解析失敗只更新 extension 狀態，不在 YouTube 頁面上打擾使用者。
