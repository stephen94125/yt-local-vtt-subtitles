import type { Cue } from "../subtitle/cue";

const OVERLAY_ID = "yt-local-vtt-subtitle-overlay";
const VISIBLE_CLASS = "yt-local-vtt-subtitle-overlay-visible";

export class OverlayRenderer {
  private readonly overlay: HTMLDivElement;
  private readonly textElement: HTMLSpanElement;

  constructor(player: Element) {
    removeExistingOverlay();

    this.overlay = document.createElement("div");
    this.overlay.id = OVERLAY_ID;

    this.textElement = document.createElement("span");
    this.textElement.className = "yt-local-vtt-subtitle-text";

    this.overlay.appendChild(this.textElement);
    player.appendChild(this.overlay);
  }

  renderCue(cue: Cue | null): void {
    if (!cue) {
      this.clear();
      return;
    }

    if (this.textElement.textContent !== cue.text) {
      this.textElement.textContent = cue.text;
    }
    this.overlay.classList.add(VISIBLE_CLASS);
  }

  clear(): void {
    this.textElement.textContent = "";
    this.overlay.classList.remove(VISIBLE_CLASS);
  }

  destroy(): void {
    this.overlay.remove();
  }
}

export function removeExistingOverlay(): void {
  document.getElementById(OVERLAY_ID)?.remove();
}
