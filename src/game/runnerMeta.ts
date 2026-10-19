import { courseDayNow, getContestWeek } from "./contest";

export type SkinId = "default" | "mint" | "sunset" | "galaxy";
export type BoardId = "classic" | "neon" | "spark" | "wave";

export type CosmeticItem = {
  id: SkinId | BoardId;
  label: string;
  cost: number;
  kind: "skin" | "board";
  rarity: "common" | "uncommon" | "rare" | "epic" | "legendary";
};

export const SKINS: CosmeticItem[] = [
  { id: "default", label: "Sky Rider", cost: 0, kind: "skin", rarity: "common" },
  { id: "mint", label: "Mint Hoodie", cost: 120, kind: "skin", rarity: "rare" },
  { id: "sunset", label: "Sunset Cap", cost: 200, kind: "skin", rarity: "epic" },
  { id: "galaxy", label: "Galaxy Jacket", cost: 350, kind: "skin", rarity: "legendary" },
];

export const BOARDS: CosmeticItem[] = [
  { id: "classic", label: "Classic Board", cost: 0, kind: "board", rarity: "common" },
  { id: "neon", label: "Neon Deck", cost: 150, kind: "board", rarity: "rare" },
  { id: "spark", label: "Spark Wheels", cost: 240, kind: "board", rarity: "epic" },
  { id: "wave", label: "Wave Rider", cost: 400, kind: "board", rarity: "legendary" },
];

export type DailyMission = {
  id: string;
  label: string;
  target: number;
  progress: number;
  reward: number;
  done: boolean;
};

export type MetaSave = {
  version: number;
  bankCoins: number;
  skin: SkinId;
  board: BoardId;
  missionsDay: string;
  missions: DailyMission[];
};

const META_KEY = "neon-alley-meta-v1";

function todayKey(now = Date.now()): string {
  return new Date(now).toLocaleDateString("en-CA", { timeZone: "America/Denver" });
}

function defaultMissions(now = Date.now()): DailyMission[] {
  const day = courseDayNow(now);
  return [
    {
      id: "stars",
      label: "Grab 25 stars in one run",
      target: 25,
      progress: 0,
      reward: 40,
      done: false,
    },
    {
      id: "combo",
      label: "Hit a ×5 combo",
      target: 5,
      progress: 0,
      reward: 35,
      done: false,
    },
    {
      id: "weekly",
      label: "Play today's shared course",
      target: 1,
      progress: 0,
      reward: 50,
      done: false,
    },
    {
      id: "season",
      label: `Season day ${day + 1} — score 800+`,
      target: 800,
      progress: 0,
      reward: 60,
      done: false,
    },
  ];
}

export function loadMeta(now = Date.now()): MetaSave {
  try {
    const raw = localStorage.getItem(META_KEY);
    if (!raw) {
      return {
        version: 1,
        bankCoins: 0,
        skin: "default",
        board: "classic",
        missionsDay: todayKey(now),
        missions: defaultMissions(now),
      };
    }
    const parsed = JSON.parse(raw) as Partial<MetaSave>;
    const missionsDay = parsed.missionsDay ?? todayKey(now);
    let missions = Array.isArray(parsed.missions) ? parsed.missions : defaultMissions(now);
    if (missionsDay !== todayKey(now)) {
      missions = defaultMissions(now);
    }
    return {
      version: 1,
      bankCoins: Math.max(0, Math.floor(parsed.bankCoins ?? 0)),
      skin: (parsed.skin as SkinId) ?? "default",
      board: (parsed.board as BoardId) ?? "classic",
      missionsDay: todayKey(now),
      missions,
    };
  } catch {
    return {
      version: 1,
      bankCoins: 0,
      skin: "default",
      board: "classic",
      missionsDay: todayKey(now),
      missions: defaultMissions(now),
    };
  }
}

export function saveMeta(meta: MetaSave) {
  try {
    localStorage.setItem(META_KEY, JSON.stringify(meta));
  } catch {
    /* private mode */
  }
}

export function addBankCoins(amount: number): number {
  const meta = loadMeta();
  meta.bankCoins = Math.max(0, meta.bankCoins + Math.max(0, Math.floor(amount)));
  saveMeta(meta);
  return meta.bankCoins;
}

function isEquipped(meta: MetaSave, item: CosmeticItem): boolean {
  return item.kind === "skin" ? meta.skin === item.id : meta.board === item.id;
}

export function tryUnlock(item: CosmeticItem): { ok: boolean; meta: MetaSave; reason?: string } {
  const meta = loadMeta();
  if (item.cost === 0 || isEquipped(meta, item)) {
    if (item.kind === "skin") meta.skin = item.id as SkinId;
    else meta.board = item.id as BoardId;
    saveMeta(meta);
    return { ok: true, meta };
  }
  if (meta.bankCoins < item.cost) {
    return { ok: false, meta, reason: "Need more coins" };
  }
  meta.bankCoins -= item.cost;
  if (item.kind === "skin") meta.skin = item.id as SkinId;
  else meta.board = item.id as BoardId;
  saveMeta(meta);
  return { ok: true, meta };
}

export function updateMissionsAfterRun(
  hud: {
    coins: number;
    maxCombo: number;
    score: number;
    mode: string;
  },
  now = Date.now(),
): MetaSave {
  const meta = loadMeta(now);
  for (const m of meta.missions) {
    if (m.done) continue;
    if (m.id === "stars") m.progress = Math.max(m.progress, hud.coins);
    if (m.id === "combo") m.progress = Math.max(m.progress, hud.maxCombo);
    if (m.id === "weekly" && hud.mode === "weekly") m.progress = 1;
    if (m.id === "season") m.progress = Math.max(m.progress, hud.score);
    if (m.progress >= m.target) {
      m.done = true;
      meta.bankCoins += m.reward;
    }
  }
  saveMeta(meta);
  return meta;
}

export function seasonLabel(now = Date.now()): string {
  const w = getContestWeek(now);
  return `Season ${w.weekIndex + 1}`;
}
