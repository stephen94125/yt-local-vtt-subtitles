export function isYouTubeCaptionOff(): boolean {
  const button = document.querySelector(".ytp-subtitles-button");
  if (!button) return true;

  const ariaPressed = button.getAttribute("aria-pressed");
  if (ariaPressed === "true") return false;
  if (ariaPressed === "false") return true;

  return !button.classList.contains("ytp-button-active");
}
