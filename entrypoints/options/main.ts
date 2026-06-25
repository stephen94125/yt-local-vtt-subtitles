import {
  clearSubtitleDirectory,
  ensureReadPermission,
  getSubtitleDirectory,
  getSubtitleDirectoryStatus,
  saveSubtitleDirectory
} from "../../src/storage/subtitleDirectory";

const statusElement = getElement("folder-status");
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
