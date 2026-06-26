# YouTube Player UI Reference

This note preserves the remaining useful ideas from `youtube-multi/` before removing the reference project. The current extension does not read YouTube official captions, so official caption APIs, `pot`, `getPlayerResponse().captions`, and `TextTrack` rendering are intentionally out of scope here.

## Useful Selectors

Player and video:

```text
#movie_player
.html5-video-player
#movie_player video
```

Control bar and caption button:

```text
.ytp-chrome-controls
button.ytp-subtitles-button.ytp-button
```

Settings menu area:

```text
.ytp-popup.ytp-settings-menu .ytp-panel .ytp-panel-menu
```

Player modes:

```text
.ytp-fullscreen
.ytp-small-mode
.ytp-autohide
```

Caption-like overlay classes:

```text
.caption-window.ytp-caption-window-bottom
.ytp-caption-segment
```

## Adding a Button Near YouTube Controls

`youtube-multi` waits for YouTube's native CC button, then inserts a custom container before it:

```ts
const ytControlPanelId = "ytControlPanel";

const stop = setInterval(() => {
  const subtitlesButton = document.querySelector("button.ytp-subtitles-button.ytp-button");
  let controlPanel = document.getElementById(ytControlPanelId);

  if (subtitlesButton && !controlPanel) {
    controlPanel = document.createElement("span");
    subtitlesButton.parentNode?.insertBefore(controlPanel, subtitlesButton);
    controlPanel.id = ytControlPanelId;
  }

  if (controlPanel) {
    clearInterval(stop);
    // Mount plain DOM UI here.
  }
}, 200);
```

For this project, keep it plain DOM instead of Preact. The important part is the mount location, not the framework.

## Button Styling

To blend into YouTube controls, use YouTube's existing button class:

```html
<button class="ytp-button" title="Local subtitles"></button>
```

For a CC-adjacent control, `youtube-multi` replaced YouTube's subtitles button with its own `button.ytp-subtitles-button.ytp-button`. For this project, prefer adding a separate button instead of hiding or replacing YouTube's native CC button. The user may still need native captions on/off state.

Useful CSS shape:

```css
#yt-local-vtt-control {
  display: inline-block;
  width: auto;
  height: 100%;
  line-height: normal;
}

#yt-local-vtt-control button {
  display: inline-block;
  background: transparent;
  border: none;
  cursor: pointer;
}
```

If an icon is used, keep it sized like YouTube controls and avoid text labels inside the control bar.

## Main World Consideration

`youtube-multi` uses:

```json
{
  "world": "MAIN",
  "run_at": "document_start"
}
```

This matters when code needs direct access to YouTube's page-world player methods. For a plain DOM button that only sends extension messages or toggles our overlay, isolated content script context is usually enough.

Use a main-world injected script only if a future feature truly needs YouTube internal methods such as:

```text
getPlayerResponse()
toggleSubtitles()
toggleSubtitlesOn()
addEventListener("onStateChange", ...)
```

## Settings Menu Insertion

`youtube-multi` also inserts a custom item into YouTube's settings panel by targeting:

```text
.ytp-popup.ytp-settings-menu .ytp-panel .ytp-panel-menu
```

This is more fragile than a control-bar button because the settings menu is created and destroyed as the user opens it. If this project later adds player UI, start with a simple control-bar button. Only add settings-menu items if there is a real need for a nested option.

## Overlay and Mode CSS Notes

For player overlays, `youtube-multi` adjusts positioning in small player mode:

```css
.ytp-small-mode.ytp-autohide
  #youtube-multi-caption-container.caption-window.ytp-caption-window-bottom {
  margin-bottom: 0;
}

.ytp-small-mode
  #youtube-multi-caption-container.caption-window.ytp-caption-window-bottom {
  margin-bottom: 32px;
}
```

This is worth remembering if the local subtitle overlay collides with controls in mini player, small mode, theater mode, or fullscreen. The exact selectors are fragile, but the mode-specific CSS idea is useful.

`youtube-multi` also uses container queries for responsive subtitle/control sizing:

```css
.ytp-chrome-controls {
  container-type: inline-size;
}
```

For this project, use this only if a player-mounted toolbar gets crowded at smaller widths.

## What Not To Carry Forward

Do not copy these parts into the current project unless the product direction changes:

- Replacing or hiding YouTube's native CC button.
- Preact/Zustand state architecture.
- YouTube official subtitle track loading.
- `pot` interception and `api/timedtext` handling.
- `TextTrack` / `VTTCue` rendering.
- SRT parsing.
- Injecting UI into the settings menu before a control-bar button is proven insufficient.

## Practical Future Plan

If adding a player button later:

1. Keep popup/options as the source of configuration.
2. Add a small DOM-only content-script button near `button.ytp-subtitles-button.ytp-button`.
3. Use the button for explicit actions such as reload local subtitle, toggle local overlay, or show current file status.
4. Do not replace YouTube's native CC button.
5. Re-run checks across normal, theater, fullscreen, and small player modes.
