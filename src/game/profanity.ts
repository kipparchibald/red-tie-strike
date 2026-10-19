/** Lightweight nickname filter — blocks obvious profanity, not exhaustive. */
const BLOCKED = [
  "ass",
  "damn",
  "fuck",
  "shit",
  "bitch",
  "bastard",
  "crap",
  "dick",
  "piss",
  "slut",
  "whore",
  "nazi",
  "fag",
  "retard",
];

const BLOCKED_RE = new RegExp(`\\b(${BLOCKED.join("|")})\\b`, "i");

export function sanitizeNickname(raw: string): string {
  const trimmed = raw.trim().slice(0, 16);
  if (!trimmed) return "Rider";
  const alnum = trimmed.replace(/[^\p{L}\p{N}\s_-]/gu, "");
  const cleaned = alnum.trim().slice(0, 16);
  if (!cleaned || BLOCKED_RE.test(cleaned)) return "Rider";
  return cleaned;
}

export function isNicknameAllowed(raw: string): boolean {
  const n = raw.trim();
  if (n.length < 1 || n.length > 16) return false;
  if (BLOCKED_RE.test(n)) return false;
  return /^[\p{L}\p{N}\s_-]+$/u.test(n);
}
