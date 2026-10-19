import { formatWeekLeft, getContestWeek } from "./contest";

export function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}

export type SeasonRemaining = {
  weekId: string;
  totalMs: number;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
};

export function getSeasonRemaining(now = Date.now()): SeasonRemaining {
  const week = getContestWeek(now);
  const totalMs = Math.max(0, week.endsAt - now);
  const totalSec = Math.floor(totalMs / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  return { weekId: week.weekId, totalMs, days, hours, minutes, seconds };
}

export function formatSeasonCompact(now = Date.now()): string {
  const week = getContestWeek(now);
  return formatWeekLeft(week.endsAt, now);
}

const TICKER_LINES = [
  "Collect stars · dodge bots · ride the combo!",
  "Weekly season — same course for every rider!",
  "Magnet · shield · double stars · boost!",
  "Nickname only on the board — stay safe!",
  "Unlock boards and outfits with saved coins!",
];

export function formatSeasonTicker(now = Date.now()): string {
  const r = getSeasonRemaining(now);
  const clock =
    r.days > 0
      ? `${r.days}d ${pad2(r.hours)}:${pad2(r.minutes)}`
      : `${pad2(r.hours)}:${pad2(r.minutes)}:${pad2(r.seconds)}`;
  const line = TICKER_LINES[Math.floor(now / 8000) % TICKER_LINES.length];
  return `  NEON ALLEY SEASON  ·  ${clock} left  ·  ${line}  ·  `;
}
