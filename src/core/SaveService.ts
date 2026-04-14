import type { RunState } from "./types";

const RUN_KEY = "pentaquest:run";

export class SaveService {
  save(run: RunState): void {
    localStorage.setItem(RUN_KEY, JSON.stringify(run));
  }

  load(): RunState | null {
    const raw = localStorage.getItem(RUN_KEY);
    if (!raw) {
      return null;
    }
    try {
      return JSON.parse(raw) as RunState;
    } catch {
      return null;
    }
  }

  clear(): void {
    localStorage.removeItem(RUN_KEY);
  }
}
