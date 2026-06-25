import {
  clearSubtitleDirectory,
  ensureReadPermission,
  getSubtitleDirectory,
  getSubtitleDirectoryStatus,
  saveSubtitleDirectory
} from "../../src/storage/subtitleDirectory";

const statusElement = getElement("folder-status");
const helpElement = getElement("folder-help");
const chooseButton = getButton("choose-folder");
const reauthorizeButton = getButton("reauthorize-folder");
const clearButton = getButton("clear-folder");

document.addEventListener("DOMContentLoaded", () => {
  chooseButton.addEventListener("click", () => {
    void chooseFolder();
  });

  reauthorizeButton.addEventListener("click", () => {
    void reauthorizeFolder();
  });

  clearButton.addEventListener("click", () => {
    void clearFolder();
  });

  void renderStatus();
});

async function chooseFolder(): Promise<void> {
  if (!("showDirectoryPicker" in window)) {
    statusElement.textContent = "File System Access API unavailable";
    helpElement.textContent = getFileSystemAccessHelp();
    return;
  }

  try {
    const handle = await window.showDirectoryPicker({ mode: "read" });
    await saveSubtitleDirectory(handle);
    await renderStatus();
  } catch {
    await renderStatus();
  }
}

async function reauthorizeFolder(): Promise<void> {
  const handle = await getSubtitleDirectory();
  if (!handle) {
    await renderStatus();
    return;
  }

  await ensureReadPermission(handle);
  await renderStatus();
}

async function clearFolder(): Promise<void> {
  await clearSubtitleDirectory();
  await renderStatus();
}

async function renderStatus(): Promise<void> {
  const status = await getSubtitleDirectoryStatus();
  statusElement.textContent = formatDirectoryStatus(status);
  helpElement.textContent = getStatusHelp(status);
}

function formatDirectoryStatus(status: Awaited<ReturnType<typeof getSubtitleDirectoryStatus>>): string {
  switch (status) {
    case "not_configured":
      return "not configured";
    case "permission_granted":
      return "configured";
    case "permission_needed":
      return "permission needed";
    default:
      return "configured";
  }
}

function getStatusHelp(status: Awaited<ReturnType<typeof getSubtitleDirectoryStatus>>): string {
  if (!("showDirectoryPicker" in window)) {
    return getFileSystemAccessHelp();
  }

  if (status === "permission_needed") {
    return "Permission is separate from folder setup. Click Re-authorize, then return to YouTube and click Reload subtitle.";
  }

  return "";
}

function getFileSystemAccessHelp(): string {
  return "Chrome/Brave may hide this API depending on version defaults. Open chrome://flags or brave://flags, search File System Access API, change Default (Disabled) to Enabled, restart the browser, then reload this extension.";
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
