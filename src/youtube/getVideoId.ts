export function getVideoId(): string | null {
  try {
    const url = new URL(location.href);
    const urlVideoId = url.searchParams.get("v");
    if (urlVideoId) return urlVideoId;
  } catch {
    return null;
  }

  const player = document.querySelector("#movie_player") as
    | (HTMLElement & { getVideoData?: () => { video_id?: string } })
    | null;
  return player?.getVideoData?.()?.video_id ?? null;
}

export function isWatchPage(): boolean {
  return location.hostname.endsWith("youtube.com") && location.pathname === "/watch";
}
