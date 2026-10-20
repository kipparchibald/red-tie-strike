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

const FLESH = {
  highlight: "#ffe7d4",
  mid: "#f0c2a2",
  shadow: "#d39672",
  deep: "#b77856",
  lip: "#c46a68",
  blush: "rgba(206, 96, 92, 0.32)",
};

const HAIR = {
  dark: "#2c1b14",
  mid: "#4a2c20",
  sheen: "rgba(196, 132, 86, 0.7)",
};

type RiderDrawOpts = {
  cx: number;
  cy: number;
  scale?: number;
  sliding?: boolean;
  emote?: boolean;
  airborne?: boolean;
};

function bone(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  thickness: number,
  fill: string,
) {
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = "rgba(18, 12, 16, 0.28)";
  ctx.lineWidth = thickness + 1.6;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.strokeStyle = fill;
  ctx.lineWidth = thickness;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.restore();
}

function drawHand(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  const palm = ctx.createRadialGradient(-1, -1, 0.4, 0, 0, 5);
  palm.addColorStop(0, FLESH.highlight);
  palm.addColorStop(1, FLESH.shadow);
  ctx.fillStyle = palm;
  ctx.beginPath();
  ctx.ellipse(0, 0, 4.4, 3.1, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(-1.8, -2.5, 1.6, 1.15, -0.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(2.6, -0.2, 1.5, 0.7, 0.4, 0, Math.PI * 2);
  ctx.ellipse(2.2, 1.2, 1.45, 0.65, 0.15, 0, Math.PI * 2);
  ctx.ellipse(1.4, 2.2, 1.3, 0.6, -0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawShoe(ctx: CanvasRenderingContext2D, x: number, y: number, trim: string) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = "#1c1917";
  ctx.beginPath();
  ctx.ellipse(3.2, 2.4, 9.2, 2.3, -0.08, 0, Math.PI * 2);
  ctx.fill();
  const upper = ctx.createLinearGradient(-6, -3, 8, 3);
  upper.addColorStop(0, "#f7f4ee");
  upper.addColorStop(0.55, "#e7e2d8");
  upper.addColorStop(1, "#cfc8bb");
  ctx.fillStyle = upper;
  ctx.beginPath();
  ctx.moveTo(-7, 1.2);
  ctx.quadraticCurveTo(-6, -3.4, 0, -3.2);
  ctx.quadraticCurveTo(8, -3, 10.5, 0.4);
  ctx.quadraticCurveTo(11, 2.6, 6, 3);
  ctx.lineTo(-6.5, 2.6);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = trim;
  ctx.fillRect(-1.5, -1.4, 5.2, 2);
  ctx.strokeStyle = "rgba(40, 32, 24, 0.35)";
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  ctx.moveTo(-2, -0.2);
  ctx.lineTo(3, -2.2);
  ctx.moveTo(0.5, 0.4);
  ctx.lineTo(5, -1.4);
  ctx.stroke();
  ctx.restore();
}

function drawHead(ctx: CanvasRenderingContext2D, emote: boolean) {
  ctx.fillStyle = FLESH.shadow;
  ctx.beginPath();
  ctx.moveTo(0, -22);
  ctx.quadraticCurveTo(3, -12, 2, -4);
  ctx.lineTo(9, -6);
  ctx.quadraticCurveTo(9, -14, 7, -22);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = FLESH.mid;
  ctx.beginPath();
  ctx.ellipse(-2, -36, 4.6, 6.4, 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(140, 78, 52, 0.5)";
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.ellipse(-1.6, -36, 2.3, 3.8, 0.2, 0.5, Math.PI * 1.6);
  ctx.stroke();

  ctx.fillStyle = FLESH.mid;
  ctx.beginPath();
  ctx.moveTo(-8, -50);
  ctx.bezierCurveTo(0, -62, 14, -60, 16, -48);
  ctx.bezierCurveTo(17.5, -42, 16, -38, 15, -36);
  ctx.bezierCurveTo(20.5, -34.2, 20.2, -29.4, 16, -28.4);
  ctx.lineTo(15.2, -26.6);
  ctx.bezierCurveTo(18, -25.2, 16.5, -23.2, 13.5, -23.4);
  ctx.bezierCurveTo(15, -21, 10, -17.5, 5, -17);
  ctx.bezierCurveTo(-2, -16, -10, -21, -13, -30);
  ctx.bezierCurveTo(-17, -40, -15, -50, -8, -50);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = FLESH.highlight;
  ctx.beginPath();
  ctx.ellipse(8, -46, 6, 5, -0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(150, 84, 54, 0.2)";
  ctx.beginPath();
  ctx.ellipse(2, -19.5, 7, 2.4, -0.2, 0, Math.PI);
  ctx.fill();
  ctx.fillStyle = FLESH.blush;
  ctx.beginPath();
  ctx.ellipse(8, -30, 3.2, 1.8, 0.15, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.translate(10, -40);
  ctx.fillStyle = "#fffaf7";
  ctx.beginPath();
  ctx.ellipse(0, 0, 4.4, emote ? 2.3 : 4.2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(60, 34, 24, 0.7)";
  ctx.lineWidth = 0.9;
  ctx.stroke();
  ctx.fillStyle = "#5c3a28";
  ctx.beginPath();
  ctx.arc(0.7, 0.4, emote ? 1.5 : 2.15, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#140e0c";
  ctx.beginPath();
  ctx.arc(0.85, 0.45, 1.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(-0.4, -0.7, 0.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = HAIR.dark;
  ctx.lineWidth = 1.25;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-4, -4.4);
  ctx.quadraticCurveTo(0.4, -6.2, 4.6, -3.8);
  ctx.stroke();
  ctx.restore();

  ctx.strokeStyle = FLESH.deep;
  ctx.lineWidth = 1.1;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(15.2, -35.2);
  ctx.quadraticCurveTo(19.6, -32.8, 16.2, -28.8);
  ctx.stroke();

  ctx.strokeStyle = FLESH.lip;
  ctx.lineWidth = 1.35;
  ctx.beginPath();
  if (emote) {
    ctx.moveTo(8, -25.2);
    ctx.quadraticCurveTo(13.5, -22.2, 16, -25.4);
  } else {
    ctx.moveTo(10, -25.6);
    ctx.quadraticCurveTo(14, -24.2, 16.2, -25.8);
  }
  ctx.stroke();

  ctx.fillStyle = HAIR.mid;
  ctx.beginPath();
  ctx.moveTo(-12, -44);
  ctx.bezierCurveTo(-16, -58, 4, -64, 16, -50);
  ctx.bezierCurveTo(18, -46, 12, -48, 8, -44);
  ctx.bezierCurveTo(2, -52, -6, -50, -12, -44);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = HAIR.dark;
  ctx.beginPath();
  ctx.moveTo(-11, -46);
  ctx.quadraticCurveTo(-18, -32, -12, -18);
  ctx.quadraticCurveTo(-7, -28, -8, -42);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = HAIR.sheen;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(-2, -56);
  ctx.quadraticCurveTo(6, -54, 12, -48);
  ctx.stroke();
}

function drawBoard(
  ctx: CanvasRenderingContext2D,
  deck: string,
  wheel: string,
  y: number,
) {
  ctx.save();
  ctx.globalAlpha = 0.35;
  const glow = ctx.createRadialGradient(0, y + 10, 2, 0, y + 10, 36);
  glow.addColorStop(0, deck);
  glow.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.ellipse(0, y + 12, 34, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  const deckGrad = ctx.createLinearGradient(0, y, 0, y + 10);
  deckGrad.addColorStop(0, "#fff");
  deckGrad.addColorStop(0.25, deck);
  deckGrad.addColorStop(1, wheel);
  ctx.fillStyle = deckGrad;
  ctx.beginPath();
  ctx.moveTo(-40, y + 4);
  ctx.quadraticCurveTo(-42, y - 2, -30, y);
  ctx.lineTo(28, y + 1);
  ctx.quadraticCurveTo(42, y + 1, 40, y + 7);
  ctx.quadraticCurveTo(20, y + 11, -28, y + 9);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "rgba(12, 10, 20, 0.45)";
  ctx.lineWidth = 1.1;
  ctx.stroke();

  ctx.fillStyle = wheel;
  for (const wx of [-22, 20]) {
    ctx.beginPath();
    ctx.ellipse(wx, y + 11, 6.5, 4.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.beginPath();
    ctx.ellipse(wx - 1, y + 10, 2.2, 1.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = wheel;
  }
}

function drawStandingRider(
  ctx: CanvasRenderingContext2D,
  hoodie: string,
  trim: string,
  deck: string,
  wheel: string,
  phase: number,
  emote: boolean,
  airborne: boolean,
) {
  const sway = Math.sin(phase * 2.4);
  const balance = airborne ? 0 : sway * 2;
  const backKnee = airborne ? { x: -6, y: 4 } : { x: -22 + balance, y: 20 };
  const frontKnee = airborne ? { x: 16, y: 0 } : { x: 20 - balance * 0.3, y: 18 };
  const backFoot = airborne ? { x: 0, y: 14 } : { x: -18, y: 32 };
  const frontFoot = airborne ? { x: 22, y: 12 } : { x: 24, y: 32 };
  const frontHand = airborne ? { x: 26, y: -10, a: -0.5 } : { x: 26, y: -2, a: 0.15 };
  const backHand = airborne ? { x: -20, y: -6, a: 0.9 } : { x: -22, y: 2, a: 2.2 };

  drawBoard(ctx, deck, wheel, airborne ? 20 : 32);

  bone(ctx, -4, -14, -16, -6, 6.4, hoodie);
  bone(ctx, -16, -6, backHand.x, backHand.y, 5.2, hoodie);
  bone(ctx, -2, 10, backKnee.x, backKnee.y, 7.6, "#314068");
  bone(ctx, backKnee.x, backKnee.y, backFoot.x, backFoot.y - 3, 6.2, "#283456");
  drawShoe(ctx, backFoot.x, backFoot.y, trim);

  const torso = ctx.createLinearGradient(-14, -20, 16, 14);
  torso.addColorStop(0, trim);
  torso.addColorStop(0.22, hoodie);
  torso.addColorStop(1, hoodie);
  ctx.fillStyle = torso;
  ctx.beginPath();
  ctx.moveTo(-10, -16);
  ctx.quadraticCurveTo(-14, 0, -6, 12);
  ctx.lineTo(8, 12);
  ctx.quadraticCurveTo(16, 0, 12, -14);
  ctx.quadraticCurveTo(2, -22, -8, -18);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "rgba(20, 12, 24, 0.25)";
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = trim;
  ctx.beginPath();
  ctx.moveTo(-6, -6);
  ctx.quadraticCurveTo(2, 0, 8, -4);
  ctx.quadraticCurveTo(2, 4, -4, 2);
  ctx.closePath();
  ctx.fill();

  bone(ctx, 6, 11, frontKnee.x, frontKnee.y, 7.8, "#3a4c78");
  bone(ctx, frontKnee.x, frontKnee.y, frontFoot.x, frontFoot.y - 3, 6.4, "#2c3a62");
  drawShoe(ctx, frontFoot.x, frontFoot.y, trim);

  bone(ctx, 8, -14, 18, -8, 6.4, hoodie);
  bone(ctx, 18, -8, frontHand.x, frontHand.y, 5.2, hoodie);
  drawHand(ctx, backHand.x, backHand.y, backHand.a);
  drawHand(ctx, frontHand.x, frontHand.y, frontHand.a);
  drawHead(ctx, emote);
}

function drawSlidingRider(
  ctx: CanvasRenderingContext2D,
  hoodie: string,
  trim: string,
  deck: string,
  wheel: string,
) {
  drawBoard(ctx, deck, wheel, 16);
  bone(ctx, -6, 8, -24, 12, 7, "#314068");
  bone(ctx, -24, 12, -34, 16, 5.5, "#283456");
  drawShoe(ctx, -30, 17, trim);
  bone(ctx, 2, 8, 16, 12, 7, "#3a4c78");
  bone(ctx, 16, 12, 26, 16, 5.5, "#2c3a62");
  drawShoe(ctx, 22, 17, trim);

  ctx.fillStyle = hoodie;
  ctx.beginPath();
  ctx.ellipse(-2, 6, 22, 9, -0.08, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = trim;
  ctx.fillRect(-6, 3, 10, 3.2);
  bone(ctx, 8, 2, 20, -2, 5.5, hoodie);
  drawHand(ctx, 22, -2, -0.2);

  ctx.save();
  ctx.translate(18, -2);
  ctx.scale(0.82, 0.82);
  drawHead(ctx, false);
  ctx.restore();
}

export function drawToonRider(
  ctx: CanvasRenderingContext2D,
  skin: SkinId,
  board: BoardId,
  phase: number,
  opts: RiderDrawOpts = {
    cx: 120,
    cy: 140,
    scale: 1,
    sliding: false,
    emote: false,
  },
) {
  const { hoodie, trim } = skinColors(skin);
  const { deck, wheel } = boardColors(board);
  const bounce = Math.sin(phase * 2.6) * (opts.emote ? 3 : 1.4);
  const breath = 1 + Math.sin(phase * 2.2) * 0.012;
  const cx = opts.cx;
  const cy = opts.cy + bounce;
  const s = (opts.scale ?? 1) * (opts.emote ? 1.04 : 1);

  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(s * breath, s / breath);
  ctx.rotate(opts.sliding ? 0 : opts.airborne ? -0.16 : -0.05);

  if (opts.sliding) {
    drawSlidingRider(ctx, hoodie, trim, deck, wheel);
  } else {
    drawStandingRider(ctx, hoodie, trim, deck, wheel, phase, Boolean(opts.emote), Boolean(opts.airborne));
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

  const equippedRarity = cosmeticRarity(
    Math.max(
      ...[
        { id: skin, cost: skin === "default" ? 0 : 120 },
        { id: board, cost: board === "classic" ? 0 : 150 },
      ].map((x) => x.cost),
    ),
  );
  drawLightBeam(ctx, w * 0.5, h * 0.52, equippedRarity, phase, h * 0.55);
  drawToonRider(ctx, skin, board, phase, {
    cx: w * 0.5,
    cy: h * 0.52,
    scale: 1.35,
    emote: true,
  });
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
