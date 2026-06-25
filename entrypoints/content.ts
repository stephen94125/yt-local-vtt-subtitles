import { browser } from "wxt/browser";
import "../src/overlay/overlay.css";
import type {
  ContentStatus,
  ExtensionMessage,
  LoadSubtitleResponse,
  SettingsResponse,
  SubtitleStatus
} from "../src/messaging/messages";
import { OverlayRenderer, removeExistingOverlay } from "../src/overlay/overlayRenderer";
import { startSubtitleSync, type StopSubtitleSync } from "../src/overlay/subtitleSync";
import { parseVtt } from "../src/subtitle/parseVtt";
import { isYouTubeCaptionOff } from "../src/youtube/captionsState";
import { getVideoId, isWatchPage } from "../src/youtube/getVideoId";
import { watchYouTubeNavigation } from "../src/youtube/navigation";
import { waitForElement } from "../src/youtube/waitForElement";

export default defineContentScript({
  matches: ["https://www.youtube.com/*"],
  runAt: "document_idle",
  main() {
    const controller = new LocalVttController();
    controller.start();
  }
});

class LocalVttController {
  private status: ContentStatus = {
    enabled: true,
    videoId: null,
    folderConfigured: false,
    subtitleStatus: "not_checked"
  };

  private overlay: OverlayRenderer | null = null;
  private stopSync: StopSubtitleSync | null = null;
  private stopNavigationWatcher: (() => void) | null = null;
  private loadToken = 0;

  start(): void {
    this.registerMessageListener();
    this.registerSettingsListener();
    this.stopNavigationWatcher = watchYouTubeNavigation(() => {
      void this.loadCurrentVideo();
    });
    void this.loadCurrentVideo();
  }

  private registerMessageListener(): void {
    browser.runtime.onMessage.addListener(async (message: ExtensionMessage) => {
      if (message.type === "GET_CONTENT_STATUS") {
        await this.refreshSettings();
        return this.status;
      }

      if (message.type === "RELOAD_CURRENT_VIDEO") {
        await this.loadCurrentVideo();
        return { ok: true };
      }

      return undefined;
    });
  }

  private registerSettingsListener(): void {
    browser.storage.onChanged.addListener((changes: Record<string, { newValue?: unknown }>, areaName: string) => {
      if (areaName !== "local" || !changes.enabled) return;
      this.status.enabled = changes.enabled.newValue !== false;

      if (!this.status.enabled) {
        this.cleanupPlayback();
        this.status.subtitleStatus = "not_checked";
        return;
      }

      void this.loadCurrentVideo();
    });
  }

  private async refreshSettings(): Promise<void> {
    try {
      const settings = (await browser.runtime.sendMessage({
        type: "GET_SETTINGS"
      } satisfies ExtensionMessage)) as SettingsResponse;
      this.status.enabled = settings.enabled;
      this.status.folderConfigured = settings.folderConfigured;
    } catch {
      this.status.enabled = true;
      this.status.folderConfigured = false;
    }
  }

  private async loadCurrentVideo(): Promise<void> {
    const token = ++this.loadToken;
    this.cleanupPlayback();
    await this.refreshSettings();

    const videoId = isWatchPage() ? getVideoId() : null;
    this.status.videoId = videoId;
    this.status.subtitleStatus = "not_checked";

    if (!this.status.enabled || !videoId) return;

    const video = await waitForElement<HTMLVideoElement>("video");
    const player =
      (await waitForElement<HTMLElement>("#movie_player", 2500)) ??
      (await waitForElement<HTMLElement>(".html5-video-player", 2500));

    if (token !== this.loadToken || !video || !player) return;

    if (!isYouTubeCaptionOff()) {
      this.status.subtitleStatus = "youtube_captions_on";
      return;
    }

    const response = (await browser.runtime.sendMessage({
      type: "LOAD_SUBTITLE",
      videoId
    } satisfies ExtensionMessage)) as LoadSubtitleResponse;

    if (token !== this.loadToken) return;

    if (!response.ok) {
      this.status.subtitleStatus = mapLoadFailure(response.reason);
      return;
    }

    try {
      const cues = parseVtt(response.text);
      if (cues.length === 0) {
        this.status.subtitleStatus = "parse_error";
        return;
      }

      this.overlay = new OverlayRenderer(player);
      this.stopSync = startSubtitleSync(video, cues, this.overlay);
      this.status.subtitleStatus = "found";
    } catch {
      this.status.subtitleStatus = "parse_error";
    }
  }

  private cleanupPlayback(): void {
    this.stopSync?.();
    this.stopSync = null;
    this.overlay?.destroy();
    this.overlay = null;
    removeExistingOverlay();
  }
}

function mapLoadFailure(reason: Extract<LoadSubtitleResponse, { ok: false }>["reason"]): SubtitleStatus {
  switch (reason) {
    case "NO_FOLDER":
      return "no_folder";
    case "NO_PERMISSION":
      return "no_permission";
    case "NOT_FOUND":
      return "not_found";
    default:
      return "not_found";
  }
}
