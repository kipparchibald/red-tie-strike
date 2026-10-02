/** First contest week begins the week of launch (America/Denver). */
export const CONTEST_EPOCH_MS = Date.parse("2026-09-14T00:00:00-06:00");
export const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export type ContestWeek = {
  weekId: string;
  weekIndex: number;
  startsAt: number;
  endsAt: number;
};

export type ContestSnapshot = {
  weekId: string;
  endsAt: number;
  startsAt: number;
  potDollars: number;
  uniqueThisWeek: number;
  lifetimePlayers: number;
  leaderScore: number;
  yourScore: number;
  youLead: boolean;
};

export function getContestWeek(now = Date.now()): ContestWeek {
  const elapsed = Math.max(0, now - CONTEST_EPOCH_MS);
  const weekIndex = Math.floor(elapsed / WEEK_MS);
  const startsAt = CONTEST_EPOCH_MS + weekIndex * WEEK_MS;
  const endsAt = startsAt + WEEK_MS;
  return { weekId: `w${weekIndex}`, weekIndex, startsAt, endsAt };
}

export type WeekCourse = {
  day: number;
  label: string;
  today: boolean;
};

export function courseDayNow(now = Date.now()): number {
  const week = getContestWeek(now);
  const day = Math.floor((now - week.startsAt) / 86400000);
  return Math.max(0, Math.min(6, day));
}

export function listWeekCourses(now = Date.now()): WeekCourse[] {
  const week = getContestWeek(now);
  return Array.from({ length: 7 }, (_, day) => {
    const start = week.startsAt + day * 86400000;
    const label = new Date(start).toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      timeZone: "America/Denver",
    });
    return { day, label, today: now >= start && now < start + 86400000 };
  });
}

export function formatWeekLeft(endsAt: number, now = Date.now()): string {
  const ms = Math.max(0, endsAt - now);
  const totalSec = Math.floor(ms / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  if (days > 0) return `${days}d ${hours.toString().padStart(2, "0")}h`;
  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

const PLAYER_KEY = "red-tie-player-id";

export function getOrCreatePlayerId(): string {
  try {
    const existing = localStorage.getItem(PLAYER_KEY);
    if (existing && existing.length >= 8) return existing;
    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(PLAYER_KEY, id);
    return id;
  } catch {
    return `p-session-${Date.now().toString(36)}`;
  }
}

export function contestShareText(score: number, jobs: string, beat: number): string {
  const link =
    typeof window !== "undefined" ? `${window.location.origin}${window.location.pathname}?beat=${beat}` : "";
  return `Red Tie Strike — ${score.toLocaleString()} this week. ${jobs}. Same course for everyone. Beat me${link ? `: ${link}` : "."}`;
}

export function emptyContestSnapshot(): ContestSnapshot {
  const w = getContestWeek();
  return {
    weekId: w.weekId,
    endsAt: w.endsAt,
    startsAt: w.startsAt,
    potDollars: 0,
    uniqueThisWeek: 0,
    lifetimePlayers: 0,
    leaderScore: 0,
    yourScore: 0,
    youLead: false,
  };
}
