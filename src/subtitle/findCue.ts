import type { Cue } from "./cue";

export function findCue(cues: Cue[], currentTime: number): Cue | null {
  let low = 0;
  let high = cues.length - 1;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const cue = cues[mid];
    if (!cue) return null;

    if (currentTime < cue.start) {
      high = mid - 1;
    } else if (currentTime > cue.end) {
      low = mid + 1;
    } else {
      return cue;
    }
  }

  return null;
}
