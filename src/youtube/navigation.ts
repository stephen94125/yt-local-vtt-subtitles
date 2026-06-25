export type NavigationStop = () => void;

export function watchYouTubeNavigation(onChanged: () => void): NavigationStop {
  let lastHref = location.href;

  const check = () => {
    if (location.href === lastHref) return;
    lastHref = location.href;
    onChanged();
  };

  const intervalId = window.setInterval(check, 500);
  window.addEventListener("popstate", check);
  window.addEventListener("yt-navigate-finish", check);

  return () => {
    window.clearInterval(intervalId);
    window.removeEventListener("popstate", check);
    window.removeEventListener("yt-navigate-finish", check);
  };
}
