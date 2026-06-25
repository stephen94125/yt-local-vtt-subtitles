import type { Cue } from "../subtitle/cue";

export type SubtitleStatus =
  | "not_checked"
  | "found"
  | "not_found"
  | "no_folder"
  | "no_permission"
  | "parse_error"
  | "youtube_captions_on";

export interface ContentStatus {
  enabled: boolean;
  videoId: string | null;
  folderConfigured: boolean;
  subtitleStatus: SubtitleStatus;
}

export type LoadSubtitleResponse =
  | { ok: true; text: string }
  | {
      ok: false;
      reason: "NO_FOLDER" | "NO_PERMISSION" | "NOT_FOUND" | "READ_ERROR";
    };

export type SettingsResponse = {
  enabled: boolean;
  folderConfigured: boolean;
};

export type ExtensionMessage =
  | { type: "LOAD_SUBTITLE"; videoId: string }
  | { type: "GET_SETTINGS" }
  | { type: "SET_ENABLED"; enabled: boolean }
  | { type: "GET_CONTENT_STATUS" }
  | { type: "RELOAD_CURRENT_VIDEO" };

export type ExtensionResponse =
  | LoadSubtitleResponse
  | SettingsResponse
  | ContentStatus
  | { ok: true }
  | { ok: false; reason: string };

export type ParsedSubtitle = {
  videoId: string;
  cues: Cue[];
};
