import { defineConfig } from "wxt";

export default defineConfig({
  manifest: {
    name: "Local VTT Subtitles for YouTube",
    description: "Display local WebVTT subtitles on YouTube when native captions are off.",
    version: "0.1.0",
    permissions: ["storage", "activeTab"],
    host_permissions: ["https://www.youtube.com/*"],
    action: {
      default_title: "Local VTT Subtitles"
    }
  }
});
