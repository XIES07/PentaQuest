export type TypographyMode = "normal" | "large" | "xlarge";

const TYPOGRAPHY_KEY = "pentaquest:typographyMode";
const DEFAULT_MODE: TypographyMode = "xlarge";

const SCALE_BY_MODE: Record<TypographyMode, number> = {
  normal: 1,
  large: 1.5,
  xlarge: 2
};

export function loadTypographyMode(): TypographyMode {
  try {
    const raw = localStorage.getItem(TYPOGRAPHY_KEY);
    if (raw === "normal" || raw === "large" || raw === "xlarge") {
      return raw;
    }
    return DEFAULT_MODE;
  } catch {
    return DEFAULT_MODE;
  }
}

export function saveTypographyMode(mode: TypographyMode): void {
  try {
    localStorage.setItem(TYPOGRAPHY_KEY, mode);
  } catch {
    // no-op
  }
}

export function getTypographyScale(mode: TypographyMode): number {
  return SCALE_BY_MODE[mode];
}
