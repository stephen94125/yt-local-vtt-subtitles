import { browser } from "wxt/browser";
import type { ExtensionMessage, ExtensionResponse } from "../src/messaging/messages";
import { getEnabled, setEnabled } from "../src/storage/settings";
import { hasSubtitleDirectory, loadSubtitleText } from "../src/storage/subtitleDirectory";

export default defineBackground(() => {
  browser.runtime.onMessage.addListener(
    async (message: ExtensionMessage): Promise<ExtensionResponse> => {
      switch (message.type) {
        case "LOAD_SUBTITLE":
          return loadSubtitleText(message.videoId);

        case "GET_SETTINGS":
          return {
            enabled: await getEnabled(),
            folderConfigured: await hasSubtitleDirectory()
          };

        case "SET_ENABLED":
          await setEnabled(message.enabled);
          return { ok: true };

        default:
          return { ok: false, reason: "UNHANDLED_MESSAGE" };
      }
    }
  );
});
