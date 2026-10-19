const STORAGE_KEY = "neon-alley-dash-v1";
const SAVE_VERSION = 2;
const SETTINGS_KEY = "neon-alley-settings-v1";
const LEGACY_STORAGE_KEY = "red-tie-strike-v1";
const LEGACY_SETTINGS_KEY = "red-tie-settings-v1";

export type Pace = "slow" | "normal" | "fast";
export type KeyScheme = "arrows" | "wasd" | "all";

export type GameSettings = {
  lives: 1 | 3 | 5;
  pace: Pace;
  shake: boolean;
  keys: KeyScheme;
  mute: boolean;
};

export const DEFAULT_SETTINGS: GameSettings = {
  lives: 3,
  pace: "normal",
  shake: true,
  keys: "all",
  mute: false,
};

export const KEY_SCHEMES: Record<
  KeyScheme,
  {
    jump: string[];
    slide: string[];
    run: string[];
    fire: string[];
    jumpLabel: string;
    slideLabel: string;
    runLabel: string;
    fireLabel: string;
  }
> = {
  arrows: {
    jump: ["Space", "ArrowUp"],
    slide: ["ArrowDown"],
    run: ["ShiftLeft", "ShiftRight", "ArrowRight"],
    fire: ["KeyZ", "ControlLeft", "ControlRight"],
    jumpLabel: "↑ Space",
    slideLabel: "↓",
    runLabel: "→ Shift",
    fireLabel: "Z Pop",
  },
  wasd: {
    jump: ["KeyW", "Space"],
    slide: ["KeyS"],
    run: ["ShiftLeft", "ShiftRight", "KeyD"],
    fire: ["KeyF", "KeyJ"],
    jumpLabel: "W Space",
    slideLabel: "S",
    runLabel: "D Shift",
    fireLabel: "F Pop",
  },
  all: {
    jump: ["Space", "ArrowUp", "KeyW", "KeyK"],
    slide: ["ArrowDown", "KeyS", "KeyL"],
    run: ["ShiftLeft", "ShiftRight", "ArrowRight", "KeyD", "KeyX"],
    fire: ["KeyF", "KeyJ", "KeyZ"],
    jumpLabel: "↑ W Space",
    slideLabel: "↓ S",
    runLabel: "→ D Shift",
    fireLabel: "F Pop",
  },
};

export function loadSettings(): GameSettings {
  try {
    let raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) raw = localStorage.getItem(LEGACY_SETTINGS_KEY);
    if (!raw) {
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      return { ...DEFAULT_SETTINGS, shake: !reduce };
    }
    const parsed = JSON.parse(raw) as Partial<GameSettings>;
    const lives = parsed.lives === 1 || parsed.lives === 5 ? parsed.lives : 3;
    const pace = parsed.pace === "slow" || parsed.pace === "fast" ? parsed.pace : "normal";
    const keys = parsed.keys === "arrows" || parsed.keys === "wasd" ? parsed.keys : "all";
    return {
      lives,
      pace,
      shake: parsed.shake !== false,
      keys,
      mute: parsed.mute === true,
    };
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
  if (save.version < SAVE_VERSION) save.version = SAVE_VERSION;
  return save;
}

export function loadHighScore(): number {
  try {
    let raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) raw = localStorage.getItem(LEGACY_STORAGE_KEY);
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
