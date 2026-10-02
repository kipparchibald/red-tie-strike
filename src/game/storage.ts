const STORAGE_KEY = "red-tie-strike-v1";
const SAVE_VERSION = 1;
const SETTINGS_KEY = "red-tie-settings-v1";

export type Pace = "slow" | "normal" | "fast";

export type GameSettings = {
  lives: 1 | 3 | 5;
  pace: Pace;
  shake: boolean;
};

export const DEFAULT_SETTINGS: GameSettings = {
  lives: 3,
  pace: "normal",
  shake: true,
};

export function loadSettings(): GameSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) {
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      return { ...DEFAULT_SETTINGS, shake: !reduce };
    }
    const parsed = JSON.parse(raw) as Partial<GameSettings>;
    const lives = parsed.lives === 1 || parsed.lives === 5 ? parsed.lives : 3;
    const pace = parsed.pace === "slow" || parsed.pace === "fast" ? parsed.pace : "normal";
    return { lives, pace, shake: parsed.shake !== false };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings: GameSettings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    /* private mode */
  }
}

export type RunnerSave = {
  version: number;
  highScore: number;
};

const DEFAULT_SAVE: RunnerSave = {
  version: SAVE_VERSION,
  highScore: 0,
};

function migrate(raw: Partial<RunnerSave> & { version?: number }): RunnerSave {
  const save: RunnerSave = {
    ...DEFAULT_SAVE,
    highScore: typeof raw.highScore === "number" ? raw.highScore : 0,
    version: typeof raw.version === "number" ? raw.version : 0,
  };
  if (save.version < 1) save.version = 1;
  return save;
}

export function loadHighScore(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return 0;
    const parsed = JSON.parse(raw) as Partial<RunnerSave>;
    return Math.max(0, Math.floor(migrate(parsed).highScore));
  } catch {
    return 0;
  }
}

export function saveHighScore(score: number): number {
  const next = Math.max(0, Math.floor(score));
  const high = Math.max(loadHighScore(), next);
  try {
    const payload: RunnerSave = { version: SAVE_VERSION, highScore: high };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    /* private mode */
  }
  return high;
}