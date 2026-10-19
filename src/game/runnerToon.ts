import type { BoardId, SkinId } from "./runnerMeta";

export type Rarity = "common" | "uncommon" | "rare" | "epic" | "legendary";

export const RARITY: Record<
  Rarity,
  { fill: string; glow: string; beam: string; outline: string; label: string }
> = {
  common: { fill: "#9ca3af", glow: "#e5e7eb", beam: "rgba(156,163,175,0.45)", outline: "#374151", label: "Common" },
  uncommon: {
    fill: "#22c55e",
    glow: "#86efac",
    beam: "rgba(34,197,94,0.5)",
    outline: "#14532d",
    label: "Uncommon",
  },
  rare: { fill: "#3b82f6", glow: "#93c5fd", beam: "rgba(59,130,246,0.55)", outline: "#1e3a8a", label: "Rare" },
  epic: { fill: "#a855f7", glow: "#e9d5ff", beam: "rgba(168,85,247,0.55)", outline: "#581c87", label: "Epic" },
  legendary: {
    fill: "#fbbf24",
    glow: "#fef08a",
    beam: "rgba(251,191,36,0.6)",
    outline: "#92400e",
    label: "Legendary",
  },
};

export const TOON = {
  outline: "#1a1028",
  outlineW: 3,
  skin: "#ffcb9a",
  skinShadow: "#e8956a",
  grass: "#4ade80",
  grassDark: "#16a34a",
  skyTop: "#38bdf8",
  skyMid: "#7dd3fc",
  skyHorizon: "#c4b5fd",
  sun: "#fde047",
};

export function lootRarity(loot: string): Rarity {
  switch (loot) {
    case "coins":
    case "shell":
      return "common";
    case "armor":
    case "magnet":
      return "uncommon";
    case "sidearm":
    case "double":
      return "rare";
    case "flare":
      return "epic";
    case "life":
      return "legendary";
    default:
      return "common";
  }
}

export function cosmeticRarity(cost: number): Rarity {
  if (cost >= 350) return "legendary";
  if (cost >= 200) return "epic";
  if (cost >= 120) return "rare";
  if (cost >= 1) return "uncommon";
  return "common";
}

export function skinColors(skin: SkinId): { hoodie: string; trim: string } {
  const map: Record<SkinId, { hoodie: string; trim: string }> = {
    default: { hoodie: "#ff6bcb", trim: "#7c3aed" },
    mint: { hoodie: "#2dd4bf", trim: "#0d9488" },
    sunset: { hoodie: "#fb923c", trim: "#ea580c" },
    galaxy: { hoodie: "#a78bfa", trim: "#6366f1" },
  };
  return map[skin];
}

export function boardColors(board: BoardId): { deck: string; wheel: string } {
  const map: Record<BoardId, { deck: string; wheel: string }> = {
    classic: { deck: "#8b5cf6", wheel: "#1e1b4b" },
    neon: { deck: "#22d3ee", wheel: "#0e7490" },
    spark: { deck: "#facc15", wheel: "#713f12" },
    wave: { deck: "#60a5fa", wheel: "#1d4ed8" },
  };
  return map[board];
}

export function strokeOutline(ctx: CanvasRenderingContext2D, width = TOON.outlineW) {
  ctx.strokeStyle = TOON.outline;
  ctx.lineWidth = width;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
}

export function drawLightBeam(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  rarity: Rarity,
  phase: number,
  height = 72,
) {
  const style = RARITY[rarity];
  const pulse = 0.75 + 0.25 * Math.sin(phase * 4);
  const g = ctx.createLinearGradient(cx, cy - height, cx, cy + 8);
  g.addColorStop(0, "rgba(255,255,255,0)");
  g.addColorStop(0.35, style.beam);
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.save();
  ctx.globalAlpha = 0.55 * pulse;
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(cx - 10 * pulse, cy + 6);
  ctx.lineTo(cx, cy - height);
  ctx.lineTo(cx + 10 * pulse, cy + 6);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

export function drawRarityOrb(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  rarity: Rarity,
  phase: number,
  glyph = "★",
) {
  const style = RARITY[rarity];
  drawLightBeam(ctx, cx, cy, rarity, phase, 48 + r);
  ctx.save();
  const glow = ctx.createRadialGradient(cx, cy, 2, cx, cy, r * 2.2);
  glow.addColorStop(0, style.glow);
  glow.addColorStop(0.55, style.fill);
  glow.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = style.fill;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  strokeOutline(ctx, 2.5);
  ctx.stroke();
  ctx.fillStyle = style.outline;
  ctx.font = `800 ${Math.floor(r * 1.1)}px Bangers, Luckiest Guy, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(glyph, cx, cy + 1);
  ctx.restore();
}

export function drawToonRider(
  ctx: CanvasRenderingContext2D,
  skin: SkinId,
  board: BoardId,
  phase: number,
  opts: { cx: number; cy: number; scale?: number; sliding?: boolean; emote?: boolean } = {
    cx: 120,
    cy: 140,
    scale: 1,
    sliding: false,
    emote: false,
  },
) {
  const { hoodie, trim } = skinColors(skin);
  const { deck, wheel } = boardColors(board);
  const bounce = Math.sin(phase * 3) * (opts.emote ? 10 : 5);
  const squash = 1 + Math.sin(phase * 6) * 0.06;
  const cx = opts.cx;
  const cy = opts.cy + bounce;
  const s = (opts.scale ?? 1) * (opts.emote ? 1.08 : 1);

  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(s * squash, s / squash);

  if (!opts.sliding) {
    ctx.fillStyle = deck;
    ctx.beginPath();
    ctx.roundRect(-38, 28, 76, 12, 6);
    ctx.fill();
    strokeOutline(ctx);
    ctx.stroke();
    ctx.fillStyle = wheel;
    ctx.beginPath();
    ctx.arc(-26, 42, 7, 0, Math.PI * 2);
    ctx.arc(26, 42, 7, 0, Math.PI * 2);
    ctx.fill();
    strokeOutline(ctx, 2);
    ctx.stroke();

    ctx.fillStyle = hoodie;
    ctx.beginPath();
    ctx.roundRect(-22, -8, 44, 38, 12);
    ctx.fill();
    strokeOutline(ctx);
    ctx.stroke();
    ctx.fillStyle = trim;
    ctx.fillRect(-8, 0, 16, 8);

    ctx.fillStyle = TOON.skin;
    ctx.beginPath();
    ctx.ellipse(0, -32, 22, 24, 0, 0, Math.PI * 2);
    ctx.fill();
    strokeOutline(ctx);
    ctx.stroke();
    ctx.fillStyle = "#2d1b4e";
    ctx.beginPath();
    ctx.ellipse(0, -44, 24, 14, 0, 0, Math.PI * 2);
    ctx.fill();
    strokeOutline(ctx, 2.5);
    ctx.stroke();
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(8, -32, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#1a1028";
    ctx.beginPath();
    ctx.arc(9, -32, 2.2, 0, Math.PI * 2);
    ctx.fill();
    if (opts.emote) {
      ctx.strokeStyle = TOON.outline;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(0, -24, 8, 0.1 * Math.PI, 0.9 * Math.PI);
      ctx.stroke();
    }

    const petBob = Math.sin(phase * 5) * 4;
    ctx.fillStyle = "#fbbf24";
    ctx.beginPath();
    ctx.ellipse(-34, 6 + petBob, 12, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    strokeOutline(ctx, 2);
    ctx.stroke();
  } else {
    ctx.fillStyle = deck;
    ctx.beginPath();
    ctx.roundRect(-40, 18, 80, 10, 5);
    ctx.fill();
    strokeOutline(ctx);
    ctx.stroke();
    ctx.fillStyle = hoodie;
    ctx.beginPath();
    ctx.roundRect(-28, 4, 56, 18, 8);
    ctx.fill();
    strokeOutline(ctx);
    ctx.stroke();
    ctx.fillStyle = TOON.skin;
    ctx.beginPath();
    ctx.ellipse(24, 8, 14, 12, 0.2, 0, Math.PI * 2);
    ctx.fill();
    strokeOutline(ctx, 2);
    ctx.stroke();
  }
  ctx.restore();
}

export function drawLobbyShowcase(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  skin: SkinId,
  board: BoardId,
  phase: number,
) {
  const bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, TOON.skyTop);
  bg.addColorStop(0.55, TOON.skyMid);
  bg.addColorStop(1, TOON.grass);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  ctx.fillStyle = "rgba(255,255,255,0.35)";
  ctx.beginPath();
  ctx.ellipse(w * 0.5, h * 0.92, w * 0.42, h * 0.08, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#6d28d9";
  ctx.beginPath();
  ctx.ellipse(w * 0.5, h * 0.78, w * 0.28, h * 0.06, 0, 0, Math.PI * 2);
  ctx.fill();
  strokeOutline(ctx, 2);
  ctx.stroke();

  drawToonRider(ctx, skin, board, phase, {
    cx: w * 0.5,
    cy: h * 0.52,
    scale: 1.35,
    emote: true,
  });

  const equippedRarity = cosmeticRarity(
    Math.max(
      ...[
        { id: skin, cost: skin === "default" ? 0 : 120 },
        { id: board, cost: board === "classic" ? 0 : 150 },
      ].map((x) => x.cost),
    ),
  );
  drawLightBeam(ctx, w * 0.5, h * 0.52, equippedRarity, phase, h * 0.55);
}

export function drawConfettiBurst(ctx: CanvasRenderingContext2D, cx: number, cy: number, phase: number, n = 24) {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + phase;
    const dist = 40 + (i % 5) * 14 + Math.sin(phase * 2 + i) * 12;
    const x = cx + Math.cos(a) * dist;
    const y = cy + Math.sin(a) * dist * 0.6 - phase * 30;
    const colors = ["#f472b6", "#a78bfa", "#38bdf8", "#facc15", "#4ade80"];
    ctx.fillStyle = colors[i % colors.length];
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(a + phase);
    ctx.fillRect(-4, -2, 8, 4);
    ctx.restore();
  }
}
