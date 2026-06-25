import { findCue } from "../subtitle/findCue";
import type { Cue } from "../subtitle/cue";
import type { OverlayRenderer } from "./overlayRenderer";

export type StopSubtitleSync = () => void;

export function startSubtitleSync(
  video: HTMLVideoElement,
  cues: Cue[],
  overlay: OverlayRenderer
): StopSubtitleSync {
  let frameId = 0;
  let stopped = false;

  const tick = () => {
    if (stopped) return;
    overlay.renderCue(findCue(cues, video.currentTime));
    frameId = window.requestAnimationFrame(tick);
  };

  frameId = window.requestAnimationFrame(tick);

  return () => {
    stopped = true;
    window.cancelAnimationFrame(frameId);
    overlay.clear();
  };
}
