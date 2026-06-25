import { idbDelete, idbGet, idbSet } from "./idb";

const DIRECTORY_HANDLE_KEY = "subtitleDirHandle";
const READ_PERMISSION: FileSystemHandlePermissionDescriptor = { mode: "read" };

export type DirectoryStatus = "configured" | "not_configured" | "permission_granted" | "permission_needed";

export async function saveSubtitleDirectory(handle: FileSystemDirectoryHandle): Promise<void> {
  await idbSet(DIRECTORY_HANDLE_KEY, handle);
}

export async function getSubtitleDirectory(): Promise<FileSystemDirectoryHandle | null> {
  return idbGet<FileSystemDirectoryHandle>(DIRECTORY_HANDLE_KEY);
}

export async function clearSubtitleDirectory(): Promise<void> {
  await idbDelete(DIRECTORY_HANDLE_KEY);
}

export async function hasSubtitleDirectory(): Promise<boolean> {
  return (await getSubtitleDirectory()) !== null;
}

export async function getSubtitleDirectoryStatus(): Promise<DirectoryStatus> {
  const handle = await getSubtitleDirectory();
  if (!handle) return "not_configured";

  const permission = await queryReadPermission(handle);
  return permission === "granted" ? "permission_granted" : "permission_needed";
}

export async function ensureReadPermission(handle: FileSystemDirectoryHandle): Promise<boolean> {
  const current = await queryReadPermission(handle);
  if (current === "granted") return true;

  try {
    const requested = await handle.requestPermission(READ_PERMISSION);
    return requested === "granted";
  } catch {
    return false;
  }
}

export async function loadSubtitleText(videoId: string): Promise<
  | { ok: true; text: string }
  | { ok: false; reason: "NO_FOLDER" | "NO_PERMISSION" | "NOT_FOUND" | "READ_ERROR" }
> {
  const handle = await getSubtitleDirectory();
  if (!handle) return { ok: false, reason: "NO_FOLDER" };

  const hasPermission = await ensureReadPermission(handle);
  if (!hasPermission) return { ok: false, reason: "NO_PERMISSION" };

  const filename = `${videoId}.zh-tw.vtt`;
  try {
    const fileHandle = await handle.getFileHandle(filename);
    const file = await fileHandle.getFile();
    return { ok: true, text: await file.text() };
  } catch (error) {
    if (isNotFoundError(error)) {
      return { ok: false, reason: "NOT_FOUND" };
    }
    return { ok: false, reason: "READ_ERROR" };
  }
}

async function queryReadPermission(handle: FileSystemDirectoryHandle): Promise<PermissionState> {
  try {
    return await handle.queryPermission(READ_PERMISSION);
  } catch {
    return "prompt";
  }
}

function isNotFoundError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "NotFoundError";
}
