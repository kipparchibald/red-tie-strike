/** 2026 US midterms — Tuesday after the first Monday in November. */
export const MIDTERM_ISO = "2026-11-03T00:00:00-05:00";
export const MIDTERM_MS = Date.parse(MIDTERM_ISO);
export const MIDTERM_LABEL = "Nov 3, 2026";

export type MidtermRemaining = {
  totalMs: number;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  expired: boolean;
};

export function getMidtermRemaining(now = Date.now()): MidtermRemaining {
  const totalMs = Math.max(0, MIDTERM_MS - now);
  const expired = totalMs <= 0;
  const totalSec = Math.floor(totalMs / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  return { totalMs, days, hours, minutes, seconds, expired };
}

export function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}

export function formatMidtermCompact(r: MidtermRemaining): string {
  if (r.expired) return "Election day";
  return `${r.days}d ${pad2(r.hours)}:${pad2(r.minutes)}:${pad2(r.seconds)}`;
}

export function formatMidtermTicker(r: MidtermRemaining): string {
  const clock = r.expired
    ? "POLLS OPEN"
    : `${r.days} DAYS  ${pad2(r.hours)}:${pad2(r.minutes)}:${pad2(r.seconds)}`;
  return `  MIDTERM CLOCK  ·  ${MIDTERM_LABEL}  ·  ${clock}  ·  HOLD THE LINE UNTIL THE VOTE  ·  `;
}
