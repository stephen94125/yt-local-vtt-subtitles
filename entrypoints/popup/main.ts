import { browser } from "wxt/browser";
import type { ContentStatus, ExtensionMessage, SettingsResponse } from "../../src/messaging/messages";

const enabledElement = getElement("enabled");
const videoIdElement = getElement("video-id");
const folderConfiguredElement = getElement("folder-configured");
const subtitleStatusElement = getElement("subtitle-status");
const toggleButton = getButton("toggle-enabled");
const reloadButton = getButton("reload-subtitle");
const openOptionsButton = getButton("open-options");

let currentEnabled = true;

document.addEventListener("DOMContentLoaded", () => {
  toggleButton.addEventListener("click", () => {
    void toggleEnabled();
  });

  reloadButton.addEventListener("click", () => {
    void sendToActiveYouTubeTab({ type: "RELOAD_CURRENT_VIDEO" });
    window.setTimeout(() => {
      void render();
    }, 250);
  });

  openOptionsButton.addEventListener("click", () => {
    void browser.runtime.openOptionsPage();
  });

  void render();
});

async function render(): Promise<void> {
  const settings = (await browser.runtime.sendMessage({
    type: "GET_SETTINGS"
  } satisfies ExtensionMessage)) as SettingsResponse;

  const contentStatus = await getActiveContentStatus();
  currentEnabled = contentStatus?.enabled ?? settings.enabled;

  enabledElement.textContent = currentEnabled ? "yes" : "no";
  videoIdElement.textContent = contentStatus?.videoId ?? "none";
  folderConfiguredElement.textContent =
    (contentStatus?.folderConfigured ?? settings.folderConfigured) ? "yes" : "no";
  subtitleStatusElement.textContent = formatSubtitleStatus(
    contentStatus?.subtitleStatus ?? "not_checked"
  );
  toggleButton.textContent = currentEnabled ? "Disable" : "Enable";
}

async function toggleEnabled(): Promise<void> {
  const enabled = !currentEnabled;
  await browser.runtime.sendMessage({
    type: "SET_ENABLED",
    enabled
  } satisfies ExtensionMessage);

  currentEnabled = enabled;
  if (!enabled) {
    await sendToActiveYouTubeTab({ type: "RELOAD_CURRENT_VIDEO" });
  }
  await render();
}

async function getActiveContentStatus(): Promise<ContentStatus | null> {
  const response = await sendToActiveYouTubeTab({ type: "GET_CONTENT_STATUS" });
  return isContentStatus(response) ? response : null;
}

async function sendToActiveYouTubeTab(message: ExtensionMessage): Promise<unknown> {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !tab.url?.startsWith("https://www.youtube.com/")) {
    return null;
  }

  try {
    return await browser.tabs.sendMessage(tab.id, message);
  } catch {
    return null;
  }
}

function isContentStatus(value: unknown): value is ContentStatus {
  return (
    typeof value === "object" &&
    value !== null &&
    "subtitleStatus" in value &&
    "enabled" in value
  );
}

function formatSubtitleStatus(status: ContentStatus["subtitleStatus"]): string {
  return status.replace(/_/g, " ");
}

function getElement(id: string): HTMLElement {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing element #${id}`);
  return element;
}

function getButton(id: string): HTMLButtonElement {
  const element = document.getElementById(id);
  if (!(element instanceof HTMLButtonElement)) throw new Error(`Missing button #${id}`);
  return element;
}
