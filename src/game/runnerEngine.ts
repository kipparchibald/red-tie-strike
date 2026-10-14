import { KEY_SCHEMES, loadHighScore, loadSettings, saveHighScore, saveSettings, type GameSettings } from "./storage";
import { formatMidtermTicker, getMidtermRemaining, pad2 } from "./midtermClock";
import { courseDayNow, getContestWeek, listWeekCourses } from "./contest";

export type GamePhase = "ready" | "playing" | "dead";

export type RunMode = "free" | "weekly" | "beat";

export type HudSnapshot = {
  phase: GamePhase;
  score: number;
  highScore: number;
  combo: number;
  maxCombo: number;
  intercepts: number;
  speed: number;
  speedNorm: number;
  distance: number;
  isNewRecord: boolean;
  lastComboBonus: number;
  fireReady: boolean;
  lives: number;
  coins: number;
  form: "normal" | "armor" | "sidearm";
  flare: number;
  boosting: boolean;
  sliding: boolean;
  jumpHeld: boolean;
  tutorialStep: number;
  tutorialTitle: string;
  tutorialKey: string;
  tutorialTouch: string;
  mode: RunMode;
  beatTarget: number;
  beatMet: boolean;
  hops: number;
  slides: number;
  auto: boolean;
  courseDay: number;
  courseLabel: string;
  tourDone: boolean;
};

type ObstacleKind = "tanker" | "drone" | "missile" | "bunker";

type Obstacle = {
  active: boolean;
  kind: ObstacleKind;
  x: number;
  w: number;
  scored: boolean;
  nearMissed: boolean;
  landed: boolean;
  slid: boolean;
  anchor: "ground" | "deck";
};

type Shell = {
  active: boolean;
  x: number;
};

type Coin = {
  active: boolean;
  x: number;
  y: number;
};

type Loot = "coins" | "shell" | "armor" | "sidearm" | "flare" | "life";
type PowerKind = "armor" | "sidearm" | "flare" | "life";

type Crate = {
  active: boolean;
  x: number;
  y: number;
  loot: Loot;
  bump: number;
};

type Powerup = {
  active: boolean;
  kind: PowerKind;
  x: number;
  y: number;
  vy: number;
  grounded: boolean;
};

type Shot = {
  active: boolean;
  x: number;
  y: number;
  hot: boolean;
};

type Particle = {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
};

type FloatText = {
  active: boolean;
  x: number;
  y: number;
  vy: number;
  life: number;
  maxLife: number;
  text: string;
  color: string;
};

export type EngineCallbacks = {
  onHud?: (hud: HudSnapshot) => void;
};

const W = 960;
const H = 540;
const GROUND_Y = 430;
const PLAYER_X = 168;
const PLAYER_W = 42;
const PLAYER_H_STAND = 66;
const PLAYER_H_SLIDE = 30;
const GRAVITY = 2400;
const JUMP_V_COAST = -680;
const JUMP_V_BOOST = -1000;
const COAST_MULT = 0.62;
const LESSONS: { title: string; key: string; touch: string }[] = [
  { title: "Jump", key: "Hold Space", touch: "Hold Jump" },
  { title: "Slide", key: "Hold Down or S", touch: "Hold Slide" },
  { title: "Run", key: "Hold Shift or X", touch: "Hold Run" },
  { title: "Clear the gap", key: "Hold Shift and Space", touch: "Hold Run and Jump" },
  { title: "Fire", key: "Tap F", touch: "Tap Fire" },
  { title: "Bust a crate", key: "Jump up into the crate", touch: "Jump up into the crate" },
];
const MAX_FALL = 1400;
const SLIDE_DURATION = 0.55;
const COYOTE = 0.09;
const JUMP_BUFFER = 0.12;
const BASE_SPEED = 360;
const MAX_SPEED = 980;
const SPEED_RAMP_DIST = 5600;
const HIT_STOP = 0.09;
const SHOT_SPEED = 780;
const FIRE_COOLDOWN = 0.28;
const TANKER_DECK = 76;
const SLIDE_GAP = 34;

const COLORS = {
  skyTop: "#12161c",
  skyMid: "#2a241c",
  skyHorizon: "#c46a3a",
  ground: "#2c261c",
  groundTop: "#4a3e2c",
  dust: "#6a5a3c",
  suit: "#1b2433",
  shirt: "#f2efe8",
  tie: "#c43c32",
  hair: "#d4b45a",
  skin: "#e0b089",
  tankerHull: "#3c4038",
  tankerBottom: "#8a3c30",
  tankerDeck: "#4a4e46",
  drone: "#2e3a28",
  missile: "#4a4034",
  bunker: "#3a342c",
  stripe: "#c43c32",
  iranGreen: "#2f6b45",
  combo: "#e8c98a",
  near: "#7ab89a",
  danger: "#e07a6a",
  tracer: "#f4e6b0",
};

function clamp(v: number, a: number, b: number) {
  return Math.max(a, Math.min(b, v));
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function easeOutBack(t: number) {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

function isShootable(kind: ObstacleKind) {
  return kind === "drone" || kind === "missile";
}

export class RunnerEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private callbacks: EngineCallbacks;
  private raf = 0;
  private lastTs = 0;
  private running = false;
  private disposed = false;

  private phase: GamePhase = "ready";
  private dpr = 1;
  private cssW = W;
  private cssH = H;

  private distance = 0;
  private score = 0;
  private highScore = 0;
  private combo = 0;
  private maxCombo = 0;
  private intercepts = 0;
  private lastComboBonus = 0;
  private isNewRecord = false;
  private speed = BASE_SPEED;
  private lives = 3;
  private coins = 0;
  private form: "normal" | "armor" | "sidearm" = "normal";
  private flareTimer = 0;

  private playerY = GROUND_Y - PLAYER_H_STAND;
  private playerVy = 0;
  private onGround = true;
  private sliding = false;
  private slideTimer = 0;
  private coyoteTimer = 0;
  private jumpBuffer = 0;
  private wantSlide = false;
  private jumpHeld = false;
  private boosting = false;
  private scaleX = 1;
  private scaleY = 1;
  private squashTimer = 0;
  private stretchTimer = 0;
  private runPhase = 0;
  private invuln = 0;
  private fireCd = 0;
  private muzzle = 0;

  private obstacles: Obstacle[] = [];
  private shots: Shot[] = [];
  private coinsPool: Coin[] = [];
  private crates: Crate[] = [];
  private shells: Shell[] = [];
  private powerups: Powerup[] = [];
  private particles: Particle[] = [];
  private floats: FloatText[] = [];
  private nextSpawnAt = 0;
  private lastKind: ObstacleKind | null = null;
  private lastLoot: Loot | null = null;

  private trauma = 0;
  private speedFx = 0;
  private tutorial = false;
  private tutorialStep = -1;
  private tutorialTimer = 0;
  private sawAir = false;
  private boostHold = 0;
  private lessonGoal = 0;
  private lessonFail = 0;
  private lessonIntercepts = 0;
  private lessonCoins = 0;
  private mode: RunMode = "free";
  private beatTarget = 0;
  private beatMet = false;
  private hops = 0;
  private slides = 0;
  private slideGrace = 0;
  private toldHop = false;
  private toldSlide = false;
  private toldShot = false;
  private auto = false;
  private courseDay = 0;
  private tourTimer = 0;
  private tourDone = false;
  private settings: GameSettings = loadSettings();
  private rng: () => number = Math.random;
  private hitStop = 0;
  private deathAnim = 0;
  private flash = 0;
  private groundScroll = 0;
  private bgScroll = 0;
  private midScroll = 0;
  private dustTimer = 0;
  private tickerX = 0;

  private keys = new Set<string>();
  private reducedMotion = false;
  private onKeyDown: (e: KeyboardEvent) => void;
  private onKeyUp: (e: KeyboardEvent) => void;
  private onPointerDown: (e: PointerEvent) => void;
  private onPointerUp: (e: PointerEvent) => void;

  constructor(canvas: HTMLCanvasElement, callbacks: EngineCallbacks = {}) {
    this.canvas = canvas;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D unavailable");
    this.ctx = ctx;
    this.callbacks = callbacks;
    this.highScore = loadHighScore();
    this.reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.initPools();
    this.resetRun();

    this.onKeyDown = (e) => this.handleKey(e, true);
    this.onKeyUp = (e) => this.handleKey(e, false);
    this.onPointerDown = (e) => this.handlePointer(e, true);
    this.onPointerUp = () => this.pressSlide(false);
    this.bindInput();
    this.resize();
    this.emitHud();
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.lastTs = 0;
    this.raf = requestAnimationFrame((t) => this.frame(t));
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  dispose() {
    this.disposed = true;
    this.stop();
    this.unbindInput();
  }

  resize() {
    const parent = this.canvas.parentElement;
    const pw = parent?.clientWidth || window.innerWidth;
    const ph = parent?.clientHeight || window.innerHeight;
    const scale = Math.min(pw / W, ph / H);
    this.cssW = Math.floor(W * scale);
    this.cssH = Math.floor(H * scale);
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.floor(this.cssW * this.dpr);
    this.canvas.height = Math.floor(this.cssH * this.dpr);
    this.canvas.style.width = `${this.cssW}px`;
    this.canvas.style.height = `${this.cssH}px`;
    this.ctx.setTransform(this.dpr * (this.cssW / W), 0, 0, this.dpr * (this.cssH / H), 0, 0);
  }

  startChallenge(mode: RunMode, beat = 0) {
    this.auto = false;
    this.tourDone = false;
    this.mode = mode;
    this.beatTarget = Math.max(0, Math.floor(beat));
    this.courseDay = courseDayNow();
    this.tutorial = false;
    this.beginRun();
  }

  playCourse(day: number) {
    this.auto = false;
    this.tourDone = false;
    this.mode = "weekly";
    this.beatTarget = 0;
    this.courseDay = Math.max(0, Math.min(6, day));
    this.tutorial = false;
    this.beginRun();
  }

  watchAll() {
    this.auto = true;
    this.tourDone = false;
    this.mode = "weekly";
    this.beatTarget = 0;
    this.courseDay = 0;
    this.tourTimer = 0;
    this.tutorial = false;
    this.beginRun();
  }

  setSettings(next: GameSettings) {
    this.settings = next;
    saveSettings(next);
  }

  stopTour() {
    this.auto = false;
    this.pressBoost(false);
    this.pressSlide(false);
    this.releaseJump();
    this.phase = "ready";
    this.emitHud();
  }

  beginRun() {
    this.tutorial = false;
    this.tutorialStep = -1;
    this.resetRun();
    this.phase = "playing";
    this.emitHud();
  }

  startTutorial() {
    this.resetRun();
    this.tutorial = true;
    this.tutorialStep = 0;
    this.tutorialTimer = 0;
    this.sawAir = false;
    this.boostHold = 0;
    this.lessonIntercepts = 0;
    this.lessonCoins = 0;
    this.beatMet = false;
    this.hops = 0;
    this.slides = 0;
    this.slideGrace = 0;
    this.toldHop = false;
    this.toldSlide = false;
    this.toldShot = false;
    this.phase = "playing";
    if (this.tutorial) this.lives = this.settings.lives;
    this.prepareLesson();
    this.emitHud();
  }

  restart() {
    this.beginRun();
  }

  pressJump() {
    if (this.phase === "ready") {
      this.beginRun();
      return;
    }
    if (this.phase === "dead") {
      this.restart();
      return;
    }
    this.jumpBuffer = JUMP_BUFFER;
    this.jumpHeld = true;
    this.tryJump();
  }

  releaseJump() {
    this.jumpHeld = false;
  }

  pressBoost(down: boolean) {
    this.boosting = down;
  }

  pressSlide(down: boolean) {
    this.wantSlide = down;
    if (down && this.phase === "playing") this.trySlide();
  }

  pressFire() {
    if (this.phase === "ready") {
      this.beginRun();
      return;
    }
    if (this.phase !== "playing" || this.fireCd > 0) return;
    const hot = this.form === "sidearm";
    this.fireCd = hot ? FIRE_COOLDOWN * 0.42 : FIRE_COOLDOWN;
    this.muzzle = 0.08;
    const support = this.currentSupportY();
    const y = this.sliding ? support - 22 : support - 88;
    this.launchShot(y, hot);
    if (hot) this.launchShot(y + 16, true);
  }

  private launchShot(y: number, hot: boolean) {
    const shot = this.shots.find((s) => !s.active);
    if (!shot) return;
    shot.active = true;
    shot.hot = hot;
    shot.x = PLAYER_X + PLAYER_W + 6;
    shot.y = y;
  }

  private initPools() {
    this.obstacles = Array.from({ length: 32 }, () => ({
      active: false,
      kind: "tanker" as ObstacleKind,
      x: 0,
      w: 40,
      scored: false,
      nearMissed: false,
      landed: false,
      slid: false,
      anchor: "ground" as const,
    }));
    this.shots = Array.from({ length: 8 }, () => ({ active: false, x: 0, y: 0, hot: false }));
    this.coinsPool = Array.from({ length: 48 }, () => ({ active: false, x: 0, y: 0 }));
    this.crates = Array.from({ length: 12 }, () => ({
      active: false,
      x: 0,
      y: 0,
      loot: "coins" as Loot,
      bump: 0,
    }));
    this.shells = Array.from({ length: 4 }, () => ({ active: false, x: 0 }));
    this.powerups = Array.from({ length: 8 }, () => ({
      active: false,
      kind: "armor" as PowerKind,
      x: 0,
      y: 0,
      vy: 0,
      grounded: false,
    }));
    this.particles = Array.from({ length: 160 }, () => ({
      active: false,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      life: 0,
      maxLife: 1,
      size: 2,
      color: COLORS.dust,
    }));
    this.floats = Array.from({ length: 16 }, () => ({
      active: false,
      x: 0,
      y: 0,
      vy: 0,
      life: 0,
      maxLife: 1,
      text: "",
      color: COLORS.combo,
    }));
  }

  private paceMul() {
    if (this.mode !== "free") return 1;
    if (this.settings.pace === "slow") return 0.82;
    if (this.settings.pace === "fast") return 1.18;
    return 1;
  }

  private lessonLine(step: number) {
    if (!this.tutorial || step < 0 || step > 5) return "";
    const scheme = KEY_SCHEMES[this.settings.keys] ?? KEY_SCHEMES.all;
    const lines = [
      `Hold ${scheme.jumpLabel}`,
      `Hold ${scheme.slideLabel}`,
      `Hold ${scheme.runLabel}`,
      `Hold ${scheme.runLabel} and jump`,
      `Tap ${scheme.fireLabel}`,
      "Jump up into the crate",
    ];
    return lines[step] ?? "";
  }

  private seedCourse() {
    if (this.mode === "free") {
      this.rng = Math.random;
      return;
    }
    let a = ((getContestWeek().weekIndex + 1) * 104729 + (this.courseDay + 1) * 7919) >>> 0;
    this.rng = () => {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  private resetRun() {
    this.seedCourse();
    this.distance = 0;
    this.score = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.intercepts = 0;
    this.lives = this.mode === "free" ? this.settings.lives : 3;
    this.coins = 0;
    this.form = "normal";
    this.flareTimer = 0;
    this.lastComboBonus = 0;
    this.isNewRecord = false;
    this.speed = BASE_SPEED;
    this.playerY = GROUND_Y - PLAYER_H_STAND;
    this.playerVy = 0;
    this.onGround = true;
    this.sliding = false;
    this.slideTimer = 0;
    this.coyoteTimer = 0;
    this.jumpBuffer = 0;
    this.wantSlide = false;
    this.jumpHeld = false;
    this.boosting = false;
    this.scaleX = 1;
    this.scaleY = 1;
    this.squashTimer = 0;
    this.stretchTimer = 0;
    this.runPhase = 0;
    this.invuln = 0;
    this.fireCd = 0;
    this.muzzle = 0;
    this.nextSpawnAt = W + 200;
    this.lastKind = null;
    this.lastLoot = null;
    this.trauma = 0;
    this.speedFx = 0;
    this.hitStop = 0;
    this.deathAnim = 0;
    this.flash = 0;
    this.groundScroll = 0;
    this.bgScroll = 0;
    this.midScroll = 0;
    this.dustTimer = 0;
    this.tickerX = 0;
    for (const o of this.obstacles) o.active = false;
    for (const s of this.shots) s.active = false;
    for (const c of this.coinsPool) c.active = false;
    for (const c of this.crates) c.active = false;
    for (const s of this.shells) s.active = false;
    for (const p of this.powerups) p.active = false;
    for (const p of this.particles) p.active = false;
    for (const f of this.floats) f.active = false;
    this.spawnCoinRow(W + 280, GROUND_Y - 108, 5);
    this.spawnCrate(W + 620, "armor");
    this.nextSpawnAt = W + 860;
  }

  private bindInput() {
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    this.canvas.addEventListener("pointerdown", this.onPointerDown);
    window.addEventListener("pointerup", this.onPointerUp);
    window.addEventListener("pointercancel", this.onPointerUp);
  }

  private unbindInput() {
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    this.canvas.removeEventListener("pointerdown", this.onPointerDown);
    window.removeEventListener("pointerup", this.onPointerUp);
    window.removeEventListener("pointercancel", this.onPointerUp);
  }

  private handleKey(e: KeyboardEvent, down: boolean) {
    const scheme = KEY_SCHEMES[this.settings.keys] ?? KEY_SCHEMES.all;
    const jump = scheme.jump.includes(e.code);
    const slide = scheme.slide.includes(e.code);
    const fire = scheme.fire.includes(e.code);
    const boost = scheme.run.includes(e.code);
    const start = e.code === "Enter";
    if (jump || slide || fire || boost || start || e.code.startsWith("Arrow")) e.preventDefault();
    if (down) this.keys.add(e.code);
    else this.keys.delete(e.code);
    if (!down) {
      if (slide && !this.held(scheme.slide)) this.pressSlide(false);
      if (jump && !this.held(scheme.jump)) this.releaseJump();
      if (boost && !this.held(scheme.run)) this.pressBoost(false);
      return;
    }
    if (jump) this.pressJump();
    else if (slide) this.pressSlide(true);
    else if (fire) this.pressFire();
    else if (boost) this.pressBoost(true);
    else if (start) {
      if (this.phase === "dead") this.restart();
      else if (this.phase === "ready") this.beginRun();
    }
  }

  private held(codes: string[]) {
    return codes.some((code) => this.keys.has(code));
  }

  private handlePointer(e: PointerEvent, down: boolean) {
    if (!down) return;
    if (!window.matchMedia("(pointer: coarse)").matches) return;
    e.preventDefault();
    const rect = this.canvas.getBoundingClientRect();
    const y = (e.clientY - rect.top) / Math.max(1, rect.height);
    if (this.phase !== "playing") return;
    if (y > 0.78) this.pressSlide(true);
    else this.pressJump();
  }

  private playerH() {
    return this.sliding ? PLAYER_H_SLIDE : PLAYER_H_STAND;
  }

  private tryJump() {
    if (this.phase !== "playing") return;
    const can = this.onGround || this.coyoteTimer > 0;
    if (!can) return;
    this.jumpBuffer = 0;
    this.onGround = false;
    this.coyoteTimer = 0;
    this.sliding = false;
    this.playerVy = this.isBoosting() ? JUMP_V_BOOST : JUMP_V_COAST;
    this.stretchTimer = 0.18;
    this.squashTimer = 0;
    this.spawnDust(PLAYER_X + PLAYER_W * 0.5, this.currentSupportY(), 8, COLORS.dust);
  }

  private trySlide() {
    if (this.phase !== "playing" || !this.onGround || this.sliding) return;
    this.sliding = true;
    this.slideTimer = SLIDE_DURATION;
    this.squashTimer = 0.2;
    this.stretchTimer = 0;
    this.playerY = this.currentSupportY() - PLAYER_H_SLIDE;
    this.spawnDust(PLAYER_X + PLAYER_W * 0.5, this.currentSupportY(), 6, COLORS.dust);
  }

  private stage() {
    if (this.distance < 1600) return 0;
    if (this.distance < 3600) return 1;
    if (this.distance < 6200) return 2;
    return 3;
  }

  private isBoosting() {
    const scheme = KEY_SCHEMES[this.settings.keys] ?? KEY_SCHEMES.all;
    return this.boosting || this.held(scheme.run);
  }

  private jumpDown() {
    const scheme = KEY_SCHEMES[this.settings.keys] ?? KEY_SCHEMES.all;
    return this.jumpHeld || this.held(scheme.jump);
  }

  private slideHeld() {
    const scheme = KEY_SCHEMES[this.settings.keys] ?? KEY_SCHEMES.all;
    return this.wantSlide || this.held(scheme.slide);
  }

  private hopPlan() {
    const fast = this.currentSpeed();
    const slow = fast * COAST_MULT;
    const airSlow = (2 * Math.abs(JUMP_V_COAST)) / GRAVITY;
    const airFast = (2 * Math.abs(JUMP_V_BOOST)) / GRAVITY;
    const gap = slow * airSlow + 72;
    const deck = Math.max(240, Math.ceil(fast * airFast - gap + 90));
    return { gap, deck };
  }

  private spawnHop() {
    const { gap, deck } = this.hopPlan();
    const x = this.nextSpawnAt;
    this.spawnObstacle("tanker", x, deck);
    this.spawnObstacle("bunker", x + deck + gap - 78, 56);
    const next = x + deck + gap;
    this.spawnObstacle("tanker", next, deck);
    this.spawnCoinRow(next + deck * 0.35, GROUND_Y - TANKER_DECK - 64, 3);
    this.nextSpawnAt = next + deck + this.densityGap();
  }

  private currentSpeed() {
    const stage = this.stage();
    if (stage === 0) return 360;
    const t = clamp((this.distance - 1600) / SPEED_RAMP_DIST, 0, 1);
    const curved = t * t * (3 - 2 * t);
    const cap = stage === 1 ? 560 : stage === 2 ? 760 : MAX_SPEED;
    return lerp(420, cap, curved);
  }

  private densityGap() {
    const stage = this.stage();
    if (stage === 0) return 460 + this.rng() * 180;
    if (stage === 1) return 400 + this.rng() * 140;
    if (stage === 2) return 300 + this.rng() * 120;
    return 220 + this.rng() * 90;
  }

  private spawnCoinRow(x: number, y: number, n: number) {
    for (let i = 0; i < n; i++) this.spawnCoin(x + i * 36, y);
  }

  private spawnCoin(x: number, y: number) {
    const c = this.coinsPool.find((q) => !q.active);
    if (!c) return;
    c.active = true;
    c.x = x;
    c.y = y;
  }

  private pickLoot(stage: number): Loot {
    const table: [Loot, number][] =
      stage <= 0
        ? [
            ["coins", 70],
            ["armor", 22],
            ["shell", 8],
          ]
        : stage === 1
          ? [
              ["coins", 42],
              ["armor", 26],
              ["shell", 16],
              ["sidearm", 12],
              ["flare", 4],
            ]
          : stage === 2
            ? [
                ["coins", 34],
                ["armor", 22],
                ["shell", 16],
                ["sidearm", 16],
                ["flare", 8],
                ["life", 4],
              ]
            : [
                ["coins", 24],
                ["armor", 18],
                ["shell", 16],
                ["sidearm", 20],
                ["flare", 12],
                ["life", 10],
              ];
    const total = table.reduce((sum, [, w]) => sum + w, 0);
    let roll = this.rng() * total;
    let loot: Loot = "coins";
    for (const [kind, weight] of table) {
      roll -= weight;
      if (roll <= 0) {
        loot = kind;
        break;
      }
    }
    const rare = loot === "flare" || loot === "life" || loot === "sidearm";
    if (rare && loot === this.lastLoot) loot = "coins";
    if (loot === "sidearm" && this.form === "sidearm") loot = "shell";
    if (loot === "armor" && this.form !== "normal") loot = this.rng() < 0.55 ? "coins" : "shell";
    if (loot === "flare" && this.flareTimer > 2) loot = "shell";
    if (loot === "life" && this.lives >= 5) loot = "coins";
    this.lastLoot = loot;
    return loot;
  }

  private spawnCrate(x: number, loot: Loot) {
    const c = this.crates.find((q) => !q.active);
    if (!c) return;
    c.active = true;
    c.x = x;
    c.y = GROUND_Y - 156;
    c.loot = loot;
    c.bump = 0;
  }

  private spawnPower(kind: PowerKind, x: number, y: number) {
    const p = this.powerups.find((q) => !q.active);
    if (!p) return;
    p.active = true;
    p.kind = kind;
    p.x = x;
    p.y = y;
    p.vy = -260;
    p.grounded = false;
  }

  private spawnShell(x: number) {
    const s = this.shells.find((q) => !q.active);
    if (!s) return;
    s.active = true;
    s.x = x;
  }

  private spawnWave() {
    const stage = this.stage();
    const x = this.nextSpawnAt;
    const roll = this.rng();

    if (stage === 0) {
      if (this.distance > 420 && roll > 0.8) {
        this.spawnHop();
        return;
      }
      if (roll < 0.74) this.spawnCoinRow(x, GROUND_Y - 100 - (roll < 0.3 ? 36 : 0), 4);
      else this.spawnCrate(x, this.pickLoot(0));
      this.nextSpawnAt = x + this.densityGap();
      return;
    }

    if (stage === 1) {
      if (roll < 0.28) {
        this.spawnCoinRow(x, GROUND_Y - 112, 4);
        this.nextSpawnAt = x + this.densityGap();
        return;
      }
      if (roll < 0.48) {
        this.spawnCrate(x, this.pickLoot(1));
        this.nextSpawnAt = x + this.densityGap();
        return;
      }
      if (roll < 0.78) {
        const tw = 240;
        this.spawnObstacle("tanker", x, tw);
        this.spawnCoinRow(x + 40, GROUND_Y - TANKER_DECK - 70, 3);
        this.nextSpawnAt = x + tw + this.densityGap();
        return;
      }
      if (roll < 0.9) this.spawnHop();
      else {
        this.spawnObstacle("drone", x);
        this.nextSpawnAt = x + 80 + this.densityGap();
      }
      return;
    }

    if (stage >= 2) {
      const crateChance = stage === 2 ? 0.14 : 0.18;
      if (roll < crateChance) {
        this.spawnCrate(x, this.pickLoot(stage));
        this.nextSpawnAt = x + this.densityGap();
        return;
      }
      if (roll < crateChance + 0.12) {
        this.spawnCoinRow(x, GROUND_Y - 120, 5);
        this.nextSpawnAt = x + this.densityGap();
        return;
      }
    }

    if (roll > 0.58 && roll < 0.82) {
      this.spawnHop();
      return;
    }

    const kind = this.pickKind();
    if (kind === "tanker") {
      const tw = stage >= 3 ? 250 + Math.floor(this.rng() * 90) : 260;
      this.spawnObstacle("tanker", x, tw);
      if (stage >= 2 && this.rng() < (stage === 3 ? 0.8 : 0.45)) {
        this.spawnObstacle("missile", x + tw * 0.45, 74, "deck");
        if (stage === 3 && tw > 280 && this.rng() < 0.4) {
          this.spawnObstacle("missile", x + tw * 0.72, 70, "deck");
        }
      }
      this.nextSpawnAt = x + tw + this.densityGap();
      return;
    }
    if (kind === "missile") {
      this.spawnObstacle("missile", x, 76, "ground");
      this.nextSpawnAt = x + 90 + this.densityGap();
      return;
    }
    this.spawnObstacle(kind, x);
    this.nextSpawnAt = x + 70 + this.densityGap();
  }

  private pickKind(): ObstacleKind {
    const stage = this.stage();
    const r = this.rng();
    let kind: ObstacleKind;
    if (stage <= 1) kind = r < 0.7 ? "tanker" : "drone";
    else if (stage === 2) kind = r < 0.34 ? "tanker" : r < 0.62 ? "missile" : r < 0.86 ? "drone" : "bunker";
    else kind = r < 0.28 ? "tanker" : r < 0.55 ? "missile" : r < 0.8 ? "drone" : "bunker";
    if (kind === this.lastKind && kind === "bunker") kind = "missile";
    this.lastKind = kind;
    return kind;
  }

  private spawnObstacle(
    kind: ObstacleKind,
    x: number,
    width?: number,
    anchor: "ground" | "deck" = "ground",
  ) {
    const o = this.obstacles.find((ob) => !ob.active);
    if (!o) return o;
    o.active = true;
    o.kind = kind;
    o.x = x;
    o.w =
      width ??
      (kind === "tanker"
        ? 250 + Math.floor(this.rng() * 90)
        : kind === "bunker"
          ? 56
          : kind === "missile"
            ? 72
            : 50);
    o.scored = false;
    o.nearMissed = false;
    o.landed = false;
    o.slid = false;
    o.anchor = anchor;
    return o;
  }

  private frame(ts: number) {
    if (this.disposed) return;
    if (!this.lastTs) this.lastTs = ts;
    let dt = Math.min(0.033, (ts - this.lastTs) / 1000);
    this.lastTs = ts;
    if (this.hitStop > 0) {
      this.hitStop -= dt;
      dt = 0;
    }
    this.update(dt);
    this.draw();
    this.raf = requestAnimationFrame((t) => this.frame(t));
  }

  private update(dt: number) {
    if (this.phase === "ready") {
      this.runPhase += dt * 8;
      this.groundScroll += BASE_SPEED * 0.15 * dt;
      this.bgScroll += BASE_SPEED * 0.04 * dt;
      this.midScroll += BASE_SPEED * 0.08 * dt;
      this.tickerX += 48 * dt;
      return;
    }
    if (this.phase === "dead") {
      this.deathAnim += dt;
      this.trauma = Math.max(0, this.trauma - dt * 1.2);
      this.flash = Math.max(0, this.flash - dt * 2);
      this.updateParticles(dt);
      this.updateFloats(dt);
      if (this.auto) this.tickAuto(dt);
      return;
    }

    if (this.tutorial && this.tutorialStep >= 0 && this.tutorialStep < 6) {
      const sprint = this.isBoosting() && this.tutorialStep >= 2;
      this.speed = sprint ? 420 : 250;
    } else {
      this.speed = this.currentSpeed() * (this.isBoosting() ? 1 : COAST_MULT) * this.paceMul();
    }
    const fxTarget = clamp((this.speed - BASE_SPEED * COAST_MULT) / (MAX_SPEED * 0.72), 0, 1);
    this.speedFx += (fxTarget - this.speedFx) * Math.min(1, dt * 6);
    this.distance += this.speed * dt;
    this.score = Math.floor(this.distance * 0.12) + this.lastComboBonus;
    this.groundScroll += this.speed * dt;
    this.bgScroll += this.speed * 0.18 * dt;
    this.midScroll += this.speed * 0.42 * dt;
    this.runPhase += dt * (10 + this.speed * 0.02);
    this.tickerX += (70 + this.speed * 0.04) * dt;
    this.fireCd = Math.max(0, this.fireCd - dt);
    this.muzzle = Math.max(0, this.muzzle - dt);
    this.invuln = Math.max(0, this.invuln - dt);
    this.flareTimer = Math.max(0, this.flareTimer - dt);

    if (this.jumpBuffer > 0) this.jumpBuffer -= dt;
    if (this.jumpBuffer > 0) this.tryJump();

    if (this.sliding) {
      this.slideTimer -= dt;
      if (this.slideTimer <= 0) {
        this.sliding = false;
        if (this.onGround) this.playerY = this.currentSupportY() - PLAYER_H_STAND;
        if (this.slideHeld()) this.trySlide();
      }
    } else if (this.slideHeld()) {
      this.trySlide();
    }

    if (this.sliding) this.slideGrace = 0.35;
    else this.slideGrace = Math.max(0, this.slideGrace - dt);

    const support = this.currentSupportY();
    const floor = support - this.playerH();

    if (!this.onGround) {
      if (this.playerVy < 0 && !this.jumpDown()) this.playerVy = Math.max(this.playerVy, -240);
      this.playerVy += GRAVITY * dt;
      this.playerVy = Math.min(this.playerVy, MAX_FALL);
      this.playerY += this.playerVy * dt;
      if (this.playerVy >= 0 && this.playerY >= floor) {
        this.playerY = floor;
        this.playerVy = 0;
        this.onGround = true;
        this.coyoteTimer = COYOTE;
        this.squashTimer = 0.16;
        this.stretchTimer = 0;
        this.spawnDust(PLAYER_X + PLAYER_W * 0.5, support, 10, COLORS.dust);
        this.noteLanding();
      }
    } else if (this.playerY + this.playerH() < support - 10) {
      this.onGround = false;
      this.coyoteTimer = COYOTE;
    } else {
      this.coyoteTimer = COYOTE;
      this.playerY = floor;
      this.dustTimer -= dt;
      if (this.dustTimer <= 0) {
        const sprint = this.isBoosting();
        this.dustTimer = sprint ? 0.028 : 0.07;
        this.spawnParticle(
          PLAYER_X + 4,
          support - 2,
          -(sprint ? this.speed * 0.45 : this.speed * 0.15) - Math.random() * 40,
          -20 - Math.random() * (sprint ? 70 : 30),
          sprint ? 0.28 : 0.18,
          2 + Math.random() * (sprint ? 3 : 2),
          sprint ? "#c9a36a" : COLORS.dust,
        );
      }
    }

    if (this.stretchTimer > 0) {
      this.stretchTimer -= dt;
      const t = 1 - this.stretchTimer / 0.18;
      const s = 1 + 0.22 * (1 - easeOutCubic(t));
      this.scaleY = s;
      this.scaleX = 1 / s;
    } else if (this.squashTimer > 0) {
      this.squashTimer -= dt;
      const t = 1 - this.squashTimer / 0.16;
      const bounce = easeOutBack(clamp(t, 0, 1));
      const s = lerp(0.72, 1, bounce);
      this.scaleY = s;
      this.scaleX = 1 / Math.max(0.7, s);
    } else {
      this.scaleX = lerp(this.scaleX, 1, 1 - Math.exp(-12 * dt));
      this.scaleY = lerp(this.scaleY, 1, 1 - Math.exp(-12 * dt));
    }

    if (!this.tutorial) {
      while (this.nextSpawnAt < this.distance + W + 200) this.spawnWave();
    }

    this.updateShells(dt);
    this.updatePickups();
    this.updatePowerups(dt);

    for (const s of this.shots) {
      if (!s.active) continue;
      s.x += SHOT_SPEED * dt;
      if (s.x > W + 40) {
        s.active = false;
        continue;
      }
      for (const o of this.obstacles) {
        if (!o.active || !isShootable(o.kind)) continue;
        const screenX = PLAYER_X + (o.x - this.distance);
        const boxes = this.obstacleBoxes(o, screenX);
        for (const b of boxes) {
          if (s.x > b.x && s.x < b.x + b.w && s.y > b.y && s.y < b.y + b.h) {
            if (!s.hot) s.active = false;
            this.destroyObstacle(o, screenX, true);
            break;
          }
        }
        if (!s.active) break;
      }
    }

    const pTop = this.playerY;
    const pBot = this.playerY + this.playerH();
    const pLeft = PLAYER_X + 6;
    const pRight = PLAYER_X + PLAYER_W - 6;

    for (const o of this.obstacles) {
      if (!o.active) continue;
      const screenX = PLAYER_X + (o.x - this.distance);
      if (screenX + o.w < -80) {
        o.active = false;
        continue;
      }
      const boxes = this.obstacleBoxes(o, screenX);
      if (o.kind === "tanker") {
        const deck = GROUND_Y - TANKER_DECK;
        const onTop = pBot <= deck + 14 && pRight > screenX + 16 && pLeft < screenX + o.w - 8;
        if (!onTop) {
          const hullHit =
            pRight > screenX + 4 && pLeft < screenX + o.w && pBot > deck + 8 && pTop < GROUND_Y;
          if (hullHit && this.invuln <= 0 && this.flareTimer <= 0) {
            this.hurt(screenX + 12, (pTop + pBot) * 0.5);
            return;
          }
        }
      } else {
        let hit = false;
        for (const b of boxes) {
          if (pRight > b.x && pLeft < b.x + b.w && pBot > b.y && pTop < b.y + b.h) {
            hit = true;
            break;
          }
        }
        if (hit && this.flareTimer > 0) {
          o.active = false;
          this.spawnBurst(screenX + o.w * 0.5, (pTop + pBot) * 0.5);
          this.awardClear(40, "FLARE", screenX, pTop - 8, COLORS.tracer);
          continue;
        }
        if (hit && this.invuln <= 0) {
          this.hurt(screenX + o.w * 0.5, (pTop + pBot) * 0.5);
          return;
        }
      }

      if (!o.nearMissed && !o.scored && screenX + o.w < pLeft && screenX + o.w > pLeft - 40) {
        const pMid = (pTop + pBot) * 0.5;
        let close = false;
        for (const b of boxes) {
          if (Math.abs(pMid - (b.y + b.h * 0.5)) < 70) close = true;
        }
        if (close) {
          o.nearMissed = true;
          const bonus = 25 + this.combo * 8;
          this.awardClear(bonus, `+${bonus}`, pRight + 8, pTop - 10, COLORS.near);
        }
      }

      if (!o.scored && screenX + o.w < pLeft - 2) {
        o.scored = true;
        if (o.kind === "missile" && !o.slid && this.slideGrace > 0 && this.challengesOn()) {
          o.slid = true;
          this.slides += 1;
          this.markJob("slides");
        }
        if (!o.nearMissed) {
          const bonus = 10 + this.combo * 4;
          this.awardClear(bonus, `×${this.combo + 1}`, pRight + 4, pTop - 4, COLORS.combo);
        } else {
          this.spawnFloat(pRight + 4, pTop - 4, `×${this.combo}`, COLORS.near);
        }
      }
    }

    this.updateParticles(dt);
    this.updateFloats(dt);
    this.trauma = Math.max(0, this.trauma - dt * 1.4);
    this.flash = Math.max(0, this.flash - dt * 3);
    this.tickTutorial(dt);
    this.tickChallenge();
    this.tickAuto(dt);
    this.emitHud();
  }

  private currentSupportY(): number {
    const pLeft = PLAYER_X + 8;
    const pRight = PLAYER_X + PLAYER_W - 8;
    const feet = this.playerY + this.playerH();
    let support = GROUND_Y;
    for (const o of this.obstacles) {
      if (!o.active || o.kind !== "tanker") continue;
      const sx = PLAYER_X + (o.x - this.distance);
      const deck = GROUND_Y - TANKER_DECK;
      const onX = pRight > sx + 16 && pLeft < sx + o.w - 8;
      if (onX && feet <= deck + 16) support = Math.min(support, deck);
    }
    for (const c of this.crates) {
      if (!c.active || c.bump > 0) continue;
      const sx = PLAYER_X + (c.x - this.distance);
      const top = c.y;
      const onX = pRight > sx && pLeft < sx + 36;
      if (onX && feet <= top + 12) support = Math.min(support, top);
    }
    return support;
  }

  private obstacleBoxes(o: Obstacle, screenX: number): { x: number; y: number; w: number; h: number }[] {
    if (o.kind === "tanker") return [{ x: screenX, y: GROUND_Y - TANKER_DECK, w: o.w, h: TANKER_DECK }];
    if (o.kind === "drone") return [{ x: screenX, y: GROUND_Y - 112, w: o.w, h: 36 }];
    if (o.kind === "missile") {
      const base = o.anchor === "deck" ? GROUND_Y - TANKER_DECK : GROUND_Y;
      const h = 64;
      return [{ x: screenX, y: base - SLIDE_GAP - h, w: o.w, h }];
    }
    return [{ x: screenX, y: GROUND_Y - 78, w: o.w, h: 78 }];
  }

  private hurt(cx: number, cy: number) {
    if (this.invuln > 0 || this.flareTimer > 0 || this.phase !== "playing") return;
    if (this.tutorial && this.tutorialStep < 6) {
      this.invuln = 0.7;
      this.onGround = false;
      this.playerVy = -340;
      this.flash = 0.2;
      this.spawnFloat(PLAYER_X, this.playerY - 20, "TRY AGAIN", COLORS.danger);
      this.prepareLesson();
      return;
    }
    this.spawnBurst(cx, cy);
    this.combo = 0;
    this.flash = 0.35;
    this.hitStop = this.reducedMotion ? 0 : 0.06;
    if (this.form === "sidearm") {
      this.form = "armor";
      this.invuln = 1.15;
      this.playerVy = -280;
      this.onGround = false;
      this.spawnFloat(PLAYER_X, this.playerY - 18, "SIDEARM DOWN", COLORS.danger);
      this.emitHud();
      return;
    }
    if (this.form === "armor") {
      this.form = "normal";
      this.invuln = 1.15;
      this.playerVy = -280;
      this.onGround = false;
      this.spawnFloat(PLAYER_X, this.playerY - 18, "ARMOR DOWN", COLORS.combo);
      this.emitHud();
      return;
    }
    this.lives -= 1;
    if (this.lives <= 0) {
      this.die(cx, cy);
      return;
    }
    this.invuln = 1.7;
    this.onGround = false;
    this.playerVy = -420;
    this.spawnFloat(PLAYER_X, this.playerY - 16, `${this.lives} left`, COLORS.danger);
    this.emitHud();
  }

  private updateShells(dt: number) {
    for (const s of this.shells) {
      if (!s.active) continue;
      s.x += (this.speed + 380) * dt;
      const screenX = PLAYER_X + (s.x - this.distance);
      if (screenX > W + 80) {
        s.active = false;
        continue;
      }
      for (const o of this.obstacles) {
        if (!o.active || o.kind === "tanker") continue;
        const ox = PLAYER_X + (o.x - this.distance);
        if (screenX + 18 > ox && screenX < ox + o.w + 6) {
          o.active = false;
          this.spawnBurst(ox + o.w * 0.4, GROUND_Y - 50);
          this.awardClear(35, "CLEAR", ox, GROUND_Y - 80, COLORS.near);
        }
      }
      for (const o of this.obstacles) {
        if (!o.active || o.kind !== "tanker") continue;
        const ox = PLAYER_X + (o.x - this.distance);
        if (screenX > ox + 8 && screenX < ox + 24) {
          s.active = false;
          break;
        }
      }
    }
  }

  private updatePickups() {
    const pTop = this.playerY;
    const pBot = this.playerY + this.playerH();
    const pLeft = PLAYER_X + 4;
    const pRight = PLAYER_X + PLAYER_W - 4;

    for (const c of this.coinsPool) {
      if (!c.active) continue;
      const sx = PLAYER_X + (c.x - this.distance);
      if (sx < -40) {
        c.active = false;
        continue;
      }
      if (pRight > sx - 8 && pLeft < sx + 16 && pBot > c.y - 8 && pTop < c.y + 16) {
        c.active = false;
        this.coins += 1;
        this.lastComboBonus += 50;
        this.spawnFloat(sx, c.y - 10, "+50", "#e8c98a");
      }
    }

    for (const crate of this.crates) {
      if (!crate.active) continue;
      if (crate.bump > 0) {
        crate.bump -= 0.016;
        if (crate.bump <= 0) crate.active = false;
        continue;
      }
      const sx = PLAYER_X + (crate.x - this.distance);
      if (sx < -60) {
        crate.active = false;
        continue;
      }
      const bottom = crate.y + 34;
      const headHit =
        this.playerVy < 0 &&
        pRight > sx &&
        pLeft < sx + 36 &&
        pTop < bottom &&
        pTop > crate.y - 6;
      if (headHit) this.bumpCrate(crate, sx);
    }
  }

  private bumpCrate(crate: Crate, sx: number) {
    crate.bump = 0.22;
    this.playerVy = 180;
    this.spawnBurst(sx + 18, crate.y + 10);
    if (crate.loot === "shell") {
      this.spawnShell(crate.x + 8);
      this.spawnFloat(sx, crate.y - 16, "SHELL", COLORS.near);
    } else if (crate.loot === "coins") {
      for (let i = 0; i < 4; i++) this.spawnCoin(crate.x - 10 + i * 18, crate.y - 20 - (i % 2) * 14);
      this.spawnFloat(sx, crate.y - 16, "BUST", COLORS.combo);
    } else {
      this.spawnPower(crate.loot, crate.x + 6, crate.y - 8);
      this.spawnFloat(sx, crate.y - 16, crate.loot.toUpperCase(), COLORS.tracer);
    }
  }

  private updatePowerups(dt: number) {
    const pTop = this.playerY;
    const pBot = this.playerY + this.playerH();
    const pLeft = PLAYER_X + 4;
    const pRight = PLAYER_X + PLAYER_W - 4;
    for (const p of this.powerups) {
      if (!p.active) continue;
      if (!p.grounded) {
        p.vy += 980 * dt;
        p.y += p.vy * dt;
        if (p.y >= GROUND_Y - 42) {
          p.y = GROUND_Y - 42;
          p.vy = 0;
          p.grounded = true;
        }
      }
      const sx = PLAYER_X + (p.x - this.distance);
      if (sx < -40) {
        p.active = false;
        continue;
      }
      if (pRight > sx && pLeft < sx + 28 && pBot > p.y && pTop < p.y + 28) this.collectPower(p);
    }
  }

  private collectPower(p: Powerup) {
    p.active = false;
    if (p.kind === "armor") {
      if (this.form === "normal") this.form = "armor";
      else this.lastComboBonus += 100;
      this.spawnFloat(PLAYER_X, this.playerY - 20, "ARMOR", COLORS.near);
    } else if (p.kind === "sidearm") {
      this.form = "sidearm";
      this.spawnFloat(PLAYER_X, this.playerY - 20, "SIDEARM", COLORS.danger);
    } else if (p.kind === "flare") {
      this.flareTimer = 6.5;
      this.spawnFloat(PLAYER_X, this.playerY - 20, "FLARE", COLORS.tracer);
    } else {
      this.lives = Math.min(5, this.lives + 1);
      this.spawnFloat(PLAYER_X, this.playerY - 20, "1-UP", COLORS.tie);
    }
    this.emitHud();
  }

  private die(cx: number, cy: number) {
    if (this.auto) {
      this.nextCourse();
      return;
    }
    this.phase = "dead";
    this.deathAnim = 0;
    this.hitStop = this.reducedMotion ? 0 : HIT_STOP;
    this.trauma = this.reducedMotion ? 0.2 : 0.85;
    this.flash = 0.5;
    this.spawnBurst(cx, cy);
    this.combo = 0;
    const prevHigh = this.highScore;
    this.isNewRecord = this.score > prevHigh && this.score > 0;
    this.highScore = saveHighScore(this.score);
    this.emitHud();
  }

  private destroyObstacle(o: Obstacle, screenX: number, shot: boolean) {
    o.active = false;
    const cy = GROUND_Y - 90;
    this.spawnBurst(screenX + o.w * 0.5, cy);
    if (shot) {
      this.intercepts += 1;
      if (this.challengesOn()) this.markJob("shots");
      const bonus = 40 + this.combo * 10;
      this.awardClear(bonus, `+${bonus}`, screenX, cy - 10, COLORS.tracer);
    }
  }

  private awardClear(bonus: number, text: string, x: number, y: number, color: string) {
    this.combo += 1;
    this.maxCombo = Math.max(this.maxCombo, this.combo);
    this.lastComboBonus += bonus;
    this.score += bonus;
    this.spawnFloat(x, y, text, color);
  }

  private spawnDust(x: number, y: number, n: number, color: string) {
    for (let i = 0; i < n; i++) {
      this.spawnParticle(x, y, -40 - Math.random() * 80, -20 - Math.random() * 60, 0.35, 2 + Math.random() * 2, color);
    }
  }

  private spawnBurst(x: number, y: number) {
    for (let i = 0; i < 18; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 40 + Math.random() * 160;
      this.spawnParticle(x, y, Math.cos(a) * sp, Math.sin(a) * sp, 0.45, 2 + Math.random() * 3, i % 2 ? COLORS.danger : COLORS.tracer);
    }
  }

  private spawnParticle(x: number, y: number, vx: number, vy: number, life: number, size: number, color: string) {
    const p = this.particles.find((q) => !q.active);
    if (!p) return;
    p.active = true;
    p.x = x;
    p.y = y;
    p.vx = vx;
    p.vy = vy;
    p.life = life;
    p.maxLife = life;
    p.size = size;
    p.color = color;
  }

  private spawnFloat(x: number, y: number, text: string, color: string) {
    const f = this.floats.find((q) => !q.active);
    if (!f) return;
    f.active = true;
    f.x = x;
    f.y = y;
    f.vy = -28;
    f.life = 0.7;
    f.maxLife = 0.7;
    f.text = text;
    f.color = color;
  }

  private updateParticles(dt: number) {
    for (const p of this.particles) {
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 400 * dt;
    }
  }

  private updateFloats(dt: number) {
    for (const f of this.floats) {
      if (!f.active) continue;
      f.life -= dt;
      if (f.life <= 0) {
        f.active = false;
        continue;
      }
      f.y += f.vy * dt;
    }
  }

  private emitHud() {
    const lo = BASE_SPEED * COAST_MULT;
    const speedNorm = clamp((this.speed - lo) / (MAX_SPEED - lo), 0, 1);
    this.callbacks.onHud?.({
      phase: this.phase,
      score: this.score,
      highScore: this.highScore,
      combo: this.combo,
      maxCombo: this.maxCombo,
      intercepts: this.intercepts,
      speed: this.speed,
      speedNorm,
      distance: this.distance,
      isNewRecord: this.isNewRecord && this.phase === "dead",
      lastComboBonus: this.lastComboBonus,
      fireReady: this.fireCd <= 0,
      lives: this.lives,
      coins: this.coins,
      form: this.form,
      flare: this.flareTimer,
      boosting: this.isBoosting(),
      sliding: this.sliding,
      jumpHeld: this.jumpDown(),
      tutorialStep: this.tutorial ? this.tutorialStep : -1,
      tutorialTitle: this.tutorial && this.tutorialStep >= 0 && this.tutorialStep < 6 ? LESSONS[this.tutorialStep].title : "",
      tutorialKey: this.lessonLine(this.tutorialStep),
      tutorialTouch: this.tutorial && this.tutorialStep >= 0 && this.tutorialStep < 6 ? LESSONS[this.tutorialStep].touch : "",
      mode: this.mode,
      beatTarget: this.beatTarget,
      beatMet: this.beatMet,
      hops: this.hops,
      slides: this.slides,
      auto: this.auto,
      courseDay: this.courseDay,
      courseLabel: listWeekCourses().find((c) => c.day === this.courseDay)?.label ?? "",
      tourDone: this.tourDone,
    });
  }

  private challengesOn() {
    return !this.tutorial && this.mode !== "free";
  }

  private noteLanding() {
    if (!this.challengesOn()) return;
    const pLeft = PLAYER_X + 8;
    const pRight = PLAYER_X + PLAYER_W - 8;
    for (const o of this.obstacles) {
      if (!o.active || o.kind !== "tanker" || o.landed) continue;
      const sx = PLAYER_X + (o.x - this.distance);
      if (pRight > sx && pLeft < sx + o.w && this.currentSupportY() < GROUND_Y - 20) {
        o.landed = true;
        this.hops += 1;
        this.markJob("hops");
      }
    }
  }

  private markJob(which: "hops" | "slides" | "shots") {
    const n = which === "hops" ? this.hops : which === "slides" ? this.slides : this.intercepts;
    if (n !== 3) return;
    if (which === "hops" && this.toldHop) return;
    if (which === "slides" && this.toldSlide) return;
    if (which === "shots" && this.toldShot) return;
    if (which === "hops") this.toldHop = true;
    if (which === "slides") this.toldSlide = true;
    if (which === "shots") this.toldShot = true;
    this.spawnFloat(PLAYER_X, this.playerY - 28, "JOB DONE", COLORS.tie);
  }

  private tickChallenge() {
    if (this.mode !== "beat" || this.beatTarget <= 0 || this.beatMet) return;
    if (this.score >= this.beatTarget) {
      this.beatMet = true;
      this.spawnFloat(PLAYER_X, this.playerY - 36, "BEAT IT", COLORS.tie);
    }
  }

  private nextCourse() {
    this.pressSlide(false);
    this.releaseJump();
    this.pressBoost(false);
    this.courseDay += 1;
    this.tourTimer = 0;
    if (this.courseDay > 6) {
      this.auto = false;
      this.tourDone = true;
      this.phase = "ready";
      this.emitHud();
      return;
    }
    this.beginRun();
  }

  private tickAuto(dt: number) {
    if (!this.auto || this.tutorial) return;
    if (this.phase !== "playing") return;
    const jobsDone = this.hops >= 3 && this.slides >= 3 && this.intercepts >= 3;
    if (jobsDone || this.distance > 4800) {
      this.tourTimer += dt;
      if (this.tourTimer > 0.9) this.nextCourse();
      return;
    }
    this.tourTimer = 0;
    this.pressBoost(true);

    const looks: { kind: ObstacleKind; sx: number; w: number; anchor: "ground" | "deck" }[] = [];
    for (const o of this.obstacles) {
      if (!o.active) continue;
      const sx = PLAYER_X + (o.x - this.distance);
      if (sx + o.w < PLAYER_X - 20 || sx > PLAYER_X + 540) continue;
      looks.push({ kind: o.kind, sx, w: o.w, anchor: o.anchor });
    }
    looks.sort((a, b) => a.sx - b.sx);

    const onDeck = this.onGround && this.currentSupportY() < GROUND_Y - 20;
    let wantSlide = false;
    let wantJump = !this.onGround && this.playerVy < 0;

    for (const o of looks) {
      const gap = o.sx - (PLAYER_X + PLAYER_W);
      if (o.kind === "missile" && o.anchor === "ground" && gap < 160 && gap > -30 && this.onGround) {
        wantSlide = true;
        wantJump = false;
        break;
      }
      if (o.kind === "bunker" && gap < 130 && gap > -8 && this.onGround && !onDeck) {
        wantJump = true;
        break;
      }
      if (o.kind === "tanker" && !onDeck && this.onGround && gap < 170 && gap > 36) {
        wantJump = true;
        break;
      }
      if (o.kind === "drone" && gap < 480 && gap > -10 && this.fireCd <= 0) this.pressFire();
    }

    if (onDeck && !wantSlide) {
      const deck = looks.find((o) => o.kind === "tanker" && o.sx < PLAYER_X + 30 && o.sx + o.w > PLAYER_X);
      const next = looks.find((o) => o.kind === "tanker" && deck && o.sx > deck.sx + 40);
      if (deck && next) {
        const lip = deck.sx + deck.w - (PLAYER_X + PLAYER_W);
        if (lip < 80 && lip > -12) wantJump = true;
      }
    }

    if (wantSlide) {
      this.releaseJump();
      this.pressSlide(true);
    } else {
      this.pressSlide(false);
      if (wantJump) this.pressJump();
      else this.releaseJump();
    }
  }

  private wipeActors() {
    for (const o of this.obstacles) o.active = false;
    for (const c of this.coinsPool) c.active = false;
    for (const c of this.crates) c.active = false;
    for (const s of this.shells) s.active = false;
    for (const p of this.powerups) p.active = false;
    for (const s of this.shots) s.active = false;
  }

  private prepareLesson() {
    this.wipeActors();
    this.tutorialTimer = 0;
    const d = this.distance;
    const step = this.tutorialStep;
    if (step === 1) this.spawnObstacle("missile", d + 460, 78, "ground");
    if (step === 3) {
      const deck = 280;
      const gap = 210;
      const start = d + 340;
      this.spawnObstacle("tanker", start, deck);
      this.spawnObstacle("tanker", start + deck + gap, deck);
      this.lessonGoal = start + deck + gap + 36;
      this.lessonFail = start + deck + gap + deck + 30;
    }
    if (step === 4) this.spawnObstacle("drone", d + 560, 52);
    if (step === 5) this.spawnCrate(d + 460, "coins");
  }

  private tickTutorial(dt: number) {
    if (!this.tutorial || this.tutorialStep >= 6) return;
    this.tutorialTimer += dt;
    const step = this.tutorialStep;
    if (step === 0) {
      if (!this.onGround) this.sawAir = true;
      if (this.sawAir && this.onGround && this.tutorialTimer > 0.4) this.advanceLesson();
      return;
    }
    if (step === 1) {
      const missile = this.obstacles.find((o) => o.active && o.kind === "missile");
      if (missile && this.sliding) {
        const sx = PLAYER_X + (missile.x - this.distance);
        if (sx < PLAYER_X + 70 && sx + missile.w > PLAYER_X - 16) this.advanceLesson();
      } else if (this.actorBehind("missile")) {
        this.spawnFloat(PLAYER_X, this.playerY - 18, "SLIDE", COLORS.danger);
        this.prepareLesson();
      }
      return;
    }
    if (step === 2) {
      if (this.isBoosting()) this.boostHold += dt;
      else this.boostHold = 0;
      if (this.boostHold > 0.55) this.advanceLesson();
      return;
    }
    if (step === 3) {
      const onDeck = this.onGround && this.currentSupportY() < GROUND_Y - 20;
      if (onDeck && this.distance > this.lessonGoal) this.advanceLesson();
      else if (this.distance > this.lessonFail) {
        this.spawnFloat(PLAYER_X, this.playerY - 18, "RUN + JUMP", COLORS.danger);
        this.prepareLesson();
      }
      return;
    }
    if (step === 4) {
      if (this.intercepts > this.lessonIntercepts) this.advanceLesson();
      else if (this.actorBehind("drone")) {
        this.spawnFloat(PLAYER_X, this.playerY - 18, "FIRE", COLORS.danger);
        this.prepareLesson();
      }
      return;
    }
    if (step === 5) {
      const bumped = this.crates.some((c) => c.active && c.bump > 0);
      if (this.coins > this.lessonCoins || bumped) this.advanceLesson();
      else if (this.crates.some((c) => c.active && PLAYER_X + (c.x - this.distance) + 36 < PLAYER_X - 16)) {
        this.spawnFloat(PLAYER_X, this.playerY - 18, "JUMP INTO IT", COLORS.danger);
        this.prepareLesson();
      }
    }
  }

  private actorBehind(kind: ObstacleKind) {
    return this.obstacles.some((o) => o.active && o.kind === kind && PLAYER_X + (o.x - this.distance) + o.w < PLAYER_X - 8);
  }

  private advanceLesson() {
    this.tutorialStep += 1;
    this.sawAir = false;
    this.boostHold = 0;
    this.lessonIntercepts = this.intercepts;
    this.lessonCoins = this.coins;
    if (this.tutorialStep < 6) this.prepareLesson();
    else this.wipeActors();
    try {
      if (this.tutorialStep >= 6) localStorage.setItem("rts-lesson-done", "1");
    } catch {
      /* ignore */
    }
    this.emitHud();
  }

  private draw() {
    const ctx = this.ctx;
    ctx.save();
    let ox = 0;
    let oy = 0;
    if (this.trauma > 0 && this.settings.shake && !this.reducedMotion) {
      const shake = this.trauma * this.trauma;
      ox = (Math.random() * 2 - 1) * 14 * shake;
      oy = (Math.random() * 2 - 1) * 10 * shake;
    }
    ctx.translate(ox, oy);
    this.drawSky(ctx);
    this.drawMountains(ctx);
    this.drawMidHills(ctx);
    this.drawGround(ctx);
    this.drawObstacles(ctx);
    this.drawPickups(ctx);
    this.drawShots(ctx);
    this.drawPlayer(ctx);
    this.drawSpeedFx(ctx);
    this.drawParticles(ctx);
    this.drawFloats(ctx);
    if (this.flash > 0) {
      ctx.fillStyle = `rgba(255, 210, 160, ${this.flash * 0.4})`;
      ctx.fillRect(-20, -20, W + 40, H + 40);
    }
    ctx.restore();
    this.drawMidtermHud(ctx);
  }

  private drawSpeedFx(ctx: CanvasRenderingContext2D) {
    const k = this.reducedMotion ? this.speedFx * 0.35 : this.speedFx;
    if (k < 0.05 || this.phase === "ready") return;
    const n = 6 + Math.floor(k * 16);
    ctx.save();
    for (let i = 0; i < n; i++) {
      const len = 24 + k * 160 + (i % 3) * 18;
      const y = 46 + ((i * 73) % (GROUND_Y - 80));
      const x = ((i * 197 - this.groundScroll * (0.35 + k * 1.4)) % (W + len + 40)) - len;
      ctx.globalAlpha = 0.06 + k * 0.28;
      ctx.fillStyle = i % 5 === 0 ? "rgba(255, 206, 140, 0.95)" : "rgba(244, 236, 220, 0.75)";
      ctx.fillRect(x, y, len, k > 0.62 ? 2 : 1);
    }
    const edge = ctx.createLinearGradient(0, 0, 110, 0);
    edge.addColorStop(0, `rgba(0, 0, 0, ${0.35 * k})`);
    edge.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.globalAlpha = 1;
    ctx.fillStyle = edge;
    ctx.fillRect(0, 36, 120, H);
    const heat = ctx.createLinearGradient(W, 0, W - 90, 0);
    heat.addColorStop(0, `rgba(255, 170, 80, ${0.16 * k})`);
    heat.addColorStop(1, "rgba(255, 170, 80, 0)");
    ctx.fillStyle = heat;
    ctx.fillRect(W - 100, 36, 100, GROUND_Y);
    ctx.restore();
  }

  private drawMidtermHud(ctx: CanvasRenderingContext2D) {
    const r = getMidtermRemaining();
    ctx.save();
    ctx.fillStyle = "rgba(10, 10, 11, 0.72)";
    ctx.fillRect(0, 0, W, 36);
    ctx.fillStyle = "rgba(244, 244, 245, 0.12)";
    ctx.fillRect(0, 36, W, 1);
    ctx.font = "600 11px Segoe UI, system-ui, sans-serif";
    ctx.fillStyle = "rgba(161, 161, 170, 1)";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText("MIDTERMS", 16, 18);
    ctx.font = "600 15px ui-monospace, SF Mono, Menlo, Consolas, monospace";
    ctx.fillStyle = r.expired ? "#7ab89a" : "#f4f4f5";
    ctx.textAlign = "right";
    const clock = r.expired ? "POLLS OPEN" : `${r.days}d  ${pad2(r.hours)}:${pad2(r.minutes)}:${pad2(r.seconds)}`;
    ctx.fillText(clock, W - 16, 18);
    if (this.phase === "playing") {
      ctx.fillStyle = "rgba(10, 10, 11, 0.45)";
      ctx.fillRect(0, 37, W, 22);
      ctx.font = "500 11px Segoe UI, system-ui, sans-serif";
      ctx.fillStyle = "rgba(201, 166, 107, 0.95)";
      ctx.textAlign = "left";
      const msg = formatMidtermTicker(r);
      const tw = Math.max(ctx.measureText(msg).width, 1);
      const x = W - (this.tickerX % tw);
      ctx.fillText(msg, x, 48);
      ctx.fillText(msg, x - tw, 48);
    }
    ctx.restore();
  }

  private drawPickups(ctx: CanvasRenderingContext2D) {
    for (const c of this.coinsPool) {
      if (!c.active) continue;
      const sx = PLAYER_X + (c.x - this.distance);
      if (sx < -20 || sx > W + 20) continue;
      const bob = Math.sin(this.runPhase * 2 + c.x * 0.02) * 3;
      const y = c.y + bob;
      ctx.fillStyle = "#8a6a28";
      ctx.beginPath();
      ctx.ellipse(sx + 8, y + 8, 9, 9, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#e8c98a";
      ctx.beginPath();
      ctx.ellipse(sx + 8, y + 8, 6.5, 6.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#8a6a28";
      ctx.font = "700 9px Segoe UI, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("$", sx + 8, y + 11);
    }

    for (const crate of this.crates) {
      if (!crate.active) continue;
      const sx = PLAYER_X + (crate.x - this.distance);
      if (sx < -40 || sx > W + 40) continue;
      const lift = crate.bump > 0 ? -8 : 0;
      const y = crate.y + lift;
      const mark =
        crate.loot === "shell"
          ? "S"
          : crate.loot === "armor"
            ? "A"
            : crate.loot === "sidearm"
              ? "F"
              : crate.loot === "flare"
                ? "*"
                : crate.loot === "life"
                  ? "+"
                  : "?";
      ctx.fillStyle =
        crate.loot === "shell" ? "#3d4a32" : crate.loot === "sidearm" ? "#6a3030" : "#6a5438";
      ctx.beginPath();
      ctx.roundRect(sx, y, 36, 34, 3);
      ctx.fill();
      ctx.strokeStyle = "rgba(244,244,245,0.35)";
      ctx.lineWidth = 2;
      ctx.strokeRect(sx + 4, y + 4, 28, 26);
      ctx.fillStyle = crate.loot === "life" ? COLORS.tie : "#e8c98a";
      ctx.font = "700 14px Segoe UI, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(mark, sx + 18, y + 22);
    }

    for (const p of this.powerups) {
      if (!p.active) continue;
      const sx = PLAYER_X + (p.x - this.distance);
      if (sx < -30 || sx > W + 30) continue;
      const y = p.y + Math.sin(this.runPhase * 3 + p.x) * 2;
      ctx.beginPath();
      if (p.kind === "armor") {
        ctx.fillStyle = "#7ab89a";
        ctx.roundRect(sx, y, 26, 22, 4);
        ctx.fill();
        ctx.fillStyle = "#1b2433";
        ctx.fillRect(sx + 8, y + 4, 10, 14);
      } else if (p.kind === "sidearm") {
        ctx.fillStyle = "#c43c32";
        ctx.roundRect(sx, y + 6, 26, 10, 3);
        ctx.fill();
        ctx.fillRect(sx + 18, y + 2, 6, 8);
      } else if (p.kind === "flare") {
        ctx.fillStyle = "#f4e6b0";
        ctx.arc(sx + 12, y + 12, 11, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#c46a3a";
        ctx.beginPath();
        ctx.arc(sx + 12, y + 12, 5, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = COLORS.tie;
        ctx.roundRect(sx + 8, y, 8, 22, 2);
        ctx.fill();
        ctx.fillStyle = "#f4f4f5";
        ctx.font = "700 11px Segoe UI, system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("+", sx + 12, y + 16);
      }
    }

    for (const s of this.shells) {
      if (!s.active) continue;
      const sx = PLAYER_X + (s.x - this.distance);
      if (sx < -30 || sx > W + 30) continue;
      ctx.save();
      ctx.translate(sx + 12, GROUND_Y - 14);
      ctx.rotate(this.runPhase * 8);
      ctx.fillStyle = "#2f6b45";
      ctx.beginPath();
      ctx.ellipse(0, 0, 14, 11, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#d4b45a";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(0, 0, 8, 6, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    ctx.textAlign = "left";
  }

  private drawSky(ctx: CanvasRenderingContext2D) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#07090d");
    g.addColorStop(0.38, "#1a1714");
    g.addColorStop(0.62, "#4a2a1c");
    g.addColorStop(0.78, "#c46a3a");
    g.addColorStop(0.9, "#e8a060");
    g.addColorStop(1, "#2a1c14");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    const sunX = W * 0.78;
    const sunY = H * 0.46;
    const glow = ctx.createRadialGradient(sunX, sunY, 8, sunX, sunY, 220);
    glow.addColorStop(0, "rgba(255, 214, 150, 0.95)");
    glow.addColorStop(0.18, "rgba(255, 150, 70, 0.55)");
    glow.addColorStop(0.5, "rgba(196, 70, 30, 0.18)");
    glow.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(sunX, sunY, 220, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffd7a0";
    ctx.beginPath();
    ctx.arc(sunX, sunY, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255, 180, 90, 0.35)";
    ctx.beginPath();
    ctx.arc(sunX, sunY, 34, 0, Math.PI * 2);
    ctx.fill();

    const t = this.runPhase;
    ctx.fillStyle = "rgba(244, 244, 245, 0.7)";
    for (let i = 0; i < 28; i++) {
      const tw = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * 0.4 + i));
      const sx = ((i * 137) % W) + ((this.bgScroll * 0.015) % 30);
      const sy = 12 + ((i * 71) % 150);
      ctx.globalAlpha = tw * 0.55;
      ctx.fillRect(sx, sy, i % 5 === 0 ? 2 : 1.2, i % 5 === 0 ? 2 : 1.2);
    }
    ctx.globalAlpha = 1;

    // distant smoke plumes
    for (let i = 0; i < 3; i++) {
      const px = 140 + i * 260 - ((this.bgScroll * 0.08) % 40);
      const py = 210 + i * 18;
      ctx.fillStyle = "rgba(40, 32, 28, 0.28)";
      ctx.beginPath();
      ctx.ellipse(px, py, 36 + i * 8, 14, -0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(px + 28, py - 18, 22, 10, -0.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawMountains(ctx: CanvasRenderingContext2D) {
    const scroll = this.bgScroll % (W * 2);
    ctx.fillStyle = "#141210";
    this.drawSilhouette(ctx, -scroll, GROUND_Y - 36, 1.15, 110);
    this.drawSilhouette(ctx, -scroll + W * 1.7, GROUND_Y - 36, 1.15, 110);
    ctx.fillStyle = "rgba(255, 160, 90, 0.06)";
    ctx.fillRect(0, GROUND_Y - 70, W, 34);
  }

  private drawMidHills(ctx: CanvasRenderingContext2D) {
    const scroll = this.midScroll % (W * 1.5);
    ctx.fillStyle = "#221c16";
    this.drawSilhouette(ctx, -scroll, GROUND_Y - 6, 0.9, 58);
    this.drawSilhouette(ctx, -scroll + W * 1.25, GROUND_Y - 6, 0.9, 58);
    // ridge highlight
    ctx.strokeStyle = "rgba(232, 160, 90, 0.18)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, GROUND_Y - 22);
    ctx.lineTo(W, GROUND_Y - 18);
    ctx.stroke();
  }

  private drawSilhouette(
    ctx: CanvasRenderingContext2D,
    offsetX: number,
    baseY: number,
    scale: number,
    height: number,
  ) {
    ctx.beginPath();
    ctx.moveTo(offsetX - 40, baseY);
    const peaks = [
      [0, 0.35],
      [90, 0.72],
      [160, 0.48],
      [240, 1],
      [320, 0.58],
      [410, 0.86],
      [500, 0.4],
      [600, 0.78],
      [700, 0.5],
      [820, 0.92],
      [940, 0.42],
      [1060, 0.7],
      [1200, 0.38],
    ];
    for (const [x, h] of peaks) {
      ctx.lineTo(offsetX + x * scale, baseY - height * h);
    }
    ctx.lineTo(offsetX + 1400 * scale, baseY);
    ctx.closePath();
    ctx.fill();
  }

  private drawGround(ctx: CanvasRenderingContext2D) {
    const sand = ctx.createLinearGradient(0, GROUND_Y, 0, H);
    sand.addColorStop(0, "#5a4630");
    sand.addColorStop(0.18, "#3a3024");
    sand.addColorStop(1, "#1a1612");
    ctx.fillStyle = sand;
    ctx.fillRect(0, GROUND_Y, W, H - GROUND_Y);

    ctx.fillStyle = "#c9a36a";
    ctx.fillRect(0, GROUND_Y, W, 3);
    ctx.fillStyle = "#2a2218";
    ctx.fillRect(0, GROUND_Y + 3, W, 5);

    const k = this.reducedMotion ? this.speedFx * 0.4 : this.speedFx;
    const streak = 18 + k * 70;
    const period = 48;
    const off = this.groundScroll % period;
    ctx.fillStyle = "rgba(20, 14, 8, 0.45)";
    for (let x = -period; x < W + period; x += period) {
      ctx.fillRect(x - off, GROUND_Y + 18, 10 + streak * 0.35, 2);
    }
    ctx.fillStyle = `rgba(232, 196, 140, ${0.08 + k * 0.2})`;
    for (let i = 0; i < 7; i++) {
      const gx = ((i * 173 - this.groundScroll * (0.55 + k)) % (W + 200)) - 40;
      ctx.fillRect(gx, GROUND_Y + 32 + (i % 3) * 12, 40 + streak, 2);
    }
  }

  private drawObstacles(ctx: CanvasRenderingContext2D) {
    for (const o of this.obstacles) {
      if (!o.active) continue;
      const screenX = PLAYER_X + (o.x - this.distance);
      if (screenX > W + 80 || screenX + o.w < -80) continue;
      if (o.kind === "tanker") this.drawTanker(ctx, screenX, o.w);
      else if (o.kind === "drone") this.drawDrone(ctx, screenX, o.w);
      else if (o.kind === "missile") this.drawMissile(ctx, o, screenX);
      else this.drawBunker(ctx, screenX, o.w);
    }
  }

  private drawTanker(ctx: CanvasRenderingContext2D, x: number, w: number) {
    const deck = GROUND_Y - TANKER_DECK;

    // water shadow
    ctx.fillStyle = "rgba(0,0,0,0.28)";
    ctx.beginPath();
    ctx.ellipse(x + w * 0.5, GROUND_Y + 6, w * 0.42, 7, 0, 0, Math.PI * 2);
    ctx.fill();

    // hull
    const hull = ctx.createLinearGradient(x, deck, x, GROUND_Y);
    hull.addColorStop(0, "#5c6258");
    hull.addColorStop(0.35, "#3a4038");
    hull.addColorStop(0.72, "#2a2e28");
    hull.addColorStop(0.73, "#8a3c30");
    hull.addColorStop(1, "#5c241c");
    ctx.fillStyle = hull;
    ctx.beginPath();
    ctx.moveTo(x + 6, deck + 4);
    ctx.quadraticCurveTo(x - 6, deck + 28, x + 18, GROUND_Y - 2);
    ctx.lineTo(x + w - 14, GROUND_Y - 2);
    ctx.quadraticCurveTo(x + w + 8, deck + 30, x + w - 10, deck + 4);
    ctx.closePath();
    ctx.fill();

    // deck plate
    ctx.fillStyle = "#6a7064";
    ctx.fillRect(x + 16, deck - 2, w - 40, 8);
    ctx.fillStyle = "#2e322c";
    ctx.fillRect(x + 16, deck + 4, w - 40, 2);

    // cargo tanks
    const n = Math.max(3, Math.min(6, Math.floor((w - 80) / 52)));
    for (let i = 0; i < n; i++) {
      const tx = x + 28 + i * ((w - 90) / n);
      const tw = Math.min(40, (w - 90) / n - 6);
      const body = ctx.createLinearGradient(tx, deck - 28, tx, deck);
      body.addColorStop(0, "#8a9084");
      body.addColorStop(0.45, "#4a5048");
      body.addColorStop(1, "#2a2e28");
      ctx.fillStyle = body;
      ctx.beginPath();
      ctx.roundRect(tx, deck - 22, tw, 22, 3);
      ctx.fill();
      ctx.fillStyle = "#c8cec0";
      ctx.beginPath();
      ctx.ellipse(tx + tw / 2, deck - 22, tw / 2, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#6a7064";
      ctx.beginPath();
      ctx.ellipse(tx + tw / 2, deck - 22, tw / 2 - 3, 3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = COLORS.stripe;
      ctx.fillRect(tx + 4, deck - 12, tw - 8, 2);
    }

    // bridge
    const bx = x + w - 54;
    ctx.fillStyle = "#1e221c";
    ctx.beginPath();
    ctx.roundRect(bx, deck - 36, 32, 38, 2);
    ctx.fill();
    ctx.fillStyle = "#d8e4ee";
    for (let r = 0; r < 2; r++) {
      for (let c = 0; c < 2; c++) {
        ctx.fillRect(bx + 6 + c * 12, deck - 28 + r * 10, 8, 6);
      }
    }
    ctx.fillStyle = "#2a2e28";
    ctx.fillRect(bx + 12, deck - 48, 3, 14);
    // flag
    ctx.fillStyle = COLORS.iranGreen;
    ctx.fillRect(bx + 15, deck - 46, 14, 4);
    ctx.fillStyle = "#f4f4f5";
    ctx.fillRect(bx + 15, deck - 42, 14, 4);
    ctx.fillStyle = COLORS.stripe;
    ctx.fillRect(bx + 15, deck - 38, 14, 4);

    // bow wave
    ctx.strokeStyle = "rgba(232, 220, 200, 0.35)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x + 10, GROUND_Y - 4);
    ctx.quadraticCurveTo(x - 16, GROUND_Y + 2, x + 8, GROUND_Y + 8);
    ctx.stroke();
  }

  private drawDrone(ctx: CanvasRenderingContext2D, x: number, w: number) {
    const y = GROUND_Y - 100;
    const cx = x + w * 0.5;
    const cy = y + 16;
    const spin = this.runPhase * 18;

    ctx.strokeStyle = "#1c2418";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx - 18, cy);
    ctx.lineTo(cx + 18, cy);
    ctx.moveTo(cx, cy - 12);
    ctx.lineTo(cx, cy + 12);
    ctx.stroke();

    for (const [px, py] of [
      [cx - 18, cy],
      [cx + 18, cy],
      [cx, cy - 12],
      [cx, cy + 12],
    ] as const) {
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(spin);
      ctx.strokeStyle = "rgba(220, 228, 210, 0.55)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(0, 0, 9, 3, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      ctx.fillStyle = "#111410";
      ctx.beginPath();
      ctx.arc(px, py, 2, 0, Math.PI * 2);
      ctx.fill();
    }

    const body = ctx.createLinearGradient(cx - 16, cy - 8, cx + 16, cy + 8);
    body.addColorStop(0, "#4a5840");
    body.addColorStop(1, "#1e261c");
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.moveTo(cx + 16, cy);
    ctx.lineTo(cx + 4, cy - 7);
    ctx.lineTo(cx - 14, cy - 4);
    ctx.lineTo(cx - 14, cy + 4);
    ctx.lineTo(cx + 4, cy + 7);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = COLORS.stripe;
    ctx.fillRect(cx - 6, cy - 1.5, 10, 3);
    ctx.fillStyle = "#9ad0ff";
    ctx.beginPath();
    ctx.arc(cx + 10, cy, 2, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawMissile(ctx: CanvasRenderingContext2D, o: Obstacle, x: number) {
    const base = o.anchor === "deck" ? GROUND_Y - TANKER_DECK : GROUND_Y;
    const y = base - SLIDE_GAP - 46;
    const w = o.w;

    // exhaust
    const flame = 0.7 + 0.3 * Math.sin(this.runPhase * 24);
    ctx.fillStyle = `rgba(255, 170, 70, ${0.55 * flame})`;
    ctx.beginPath();
    ctx.ellipse(x + w + 6, y + 14, 16 * flame, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = `rgba(255, 240, 180, ${0.8 * flame})`;
    ctx.beginPath();
    ctx.ellipse(x + w - 2, y + 14, 8, 3.5, 0, 0, Math.PI * 2);
    ctx.fill();

    const body = ctx.createLinearGradient(x, y, x, y + 28);
    body.addColorStop(0, "#6a6258");
    body.addColorStop(0.45, "#3a342c");
    body.addColorStop(1, "#1e1a16");
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.roundRect(x + 16, y + 6, w - 22, 16, 3);
    ctx.fill();

    ctx.fillStyle = "#c43c32";
    ctx.beginPath();
    ctx.moveTo(x, y + 14);
    ctx.lineTo(x + 22, y + 2);
    ctx.lineTo(x + 22, y + 26);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "#1a1612";
    ctx.beginPath();
    ctx.moveTo(x + w - 20, y + 6);
    ctx.lineTo(x + w - 6, y + 6);
    ctx.lineTo(x + w - 14, y - 2);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x + w - 20, y + 22);
    ctx.lineTo(x + w - 6, y + 22);
    ctx.lineTo(x + w - 14, y + 30);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = COLORS.iranGreen;
    ctx.fillRect(x + w * 0.45, y + 10, 10, 8);
    ctx.fillStyle = "#f4f4f5";
    ctx.fillRect(x + w * 0.45 + 10, y + 10, 8, 8);
    ctx.strokeStyle = "rgba(255,255,255,0.25)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + 24, y + 9);
    ctx.lineTo(x + w - 18, y + 9);
    ctx.stroke();
  }

  private drawBunker(ctx: CanvasRenderingContext2D, x: number, w: number) {
    const h = 78;
    const y = GROUND_Y - h;
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.beginPath();
    ctx.ellipse(x + w / 2, GROUND_Y + 4, w * 0.45, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    const wall = ctx.createLinearGradient(x, y, x + w, GROUND_Y);
    wall.addColorStop(0, "#6a5e4e");
    wall.addColorStop(0.4, "#3a342c");
    wall.addColorStop(1, "#241e18");
    ctx.fillStyle = wall;
    ctx.beginPath();
    ctx.moveTo(x + 4, GROUND_Y);
    ctx.lineTo(x + 8, y + 16);
    ctx.lineTo(x + w * 0.5, y);
    ctx.lineTo(x + w - 8, y + 16);
    ctx.lineTo(x + w - 4, GROUND_Y);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "#14110e";
    ctx.fillRect(x + w * 0.28, y + 28, w * 0.44, 8);
    ctx.fillStyle = "rgba(255, 180, 90, 0.35)";
    ctx.fillRect(x + w * 0.32, y + 30, w * 0.16, 4);

    ctx.fillStyle = COLORS.iranGreen;
    ctx.fillRect(x + 8, y + 18, 8, 4);
    ctx.fillStyle = "#f4f4f5";
    ctx.fillRect(x + 16, y + 18, 8, 4);
    ctx.fillStyle = COLORS.stripe;
    ctx.fillRect(x + 24, y + 18, 8, 4);
  }

  private drawShots(ctx: CanvasRenderingContext2D) {
    for (const s of this.shots) {
      if (!s.active) continue;
      const g = ctx.createLinearGradient(s.x - 28, s.y, s.x + 10, s.y);
      g.addColorStop(0, "rgba(255, 210, 120, 0)");
      g.addColorStop(0.55, "rgba(255, 230, 160, 0.85)");
      g.addColorStop(1, "#fff6d0");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.roundRect(s.x - 28, s.y - 2, 36, 4, 2);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(s.x + 6, s.y, 2.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawPlayer(ctx: CanvasRenderingContext2D) {
    const h = this.playerH();
    const w = PLAYER_W;
    const cx = PLAYER_X + w / 2;

    const supportY = this.phase === "playing" || this.phase === "ready" ? this.currentSupportY() : GROUND_Y;
    const shadowScale = clamp(1 - (supportY - (this.playerY + h)) / 160, 0.35, 1);
    ctx.save();
    ctx.globalAlpha = this.phase === "dead" ? 0.12 : 0.35;
    ctx.fillStyle = "#000";
    ctx.beginPath();
    ctx.ellipse(cx, supportY + 3, 22 * shadowScale, 5 * shadowScale, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    let rot = 0;
    let alpha = 1;
    if (this.phase === "dead") {
      rot = this.deathAnim * 8;
      alpha = clamp(1 - this.deathAnim * 0.55, 0.15, 1);
    }

    ctx.save();
    ctx.globalAlpha = this.invuln > 0 && Math.floor(this.invuln * 12) % 2 === 0 ? 0.35 : alpha;
    const deathOx = this.phase === "dead" ? -this.deathAnim * 60 : 0;
    const deathOy =
      this.phase === "dead" ? -this.deathAnim * 40 + this.deathAnim * this.deathAnim * 180 : 0;
    const cy = this.playerY + h / 2;
    if (this.phase === "playing" && !this.sliding) rot += this.speedFx * 0.2;
    ctx.translate(cx + deathOx, cy + deathOy);
    ctx.rotate(rot);
    const powered = this.form !== "normal" ? 1.12 : 1;
    ctx.scale(this.scaleX * powered, this.scaleY * powered);
    if (this.flareTimer > 0) {
      ctx.strokeStyle = `rgba(244, 230, 176, ${0.45 + 0.4 * Math.sin(this.runPhase * 10)})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(0, 0, 28, this.sliding ? 16 : 40, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    const bw = w * 0.82;
    const bh = h * 0.72;
    const top = -bh / 2;

    if (!this.sliding) {
      // jacket
      const jacket = ctx.createLinearGradient(-bw / 2, top, bw / 2, top + bh);
      jacket.addColorStop(0, "#2a3548");
      jacket.addColorStop(1, "#121820");
      ctx.fillStyle = jacket;
      ctx.beginPath();
      ctx.moveTo(-bw / 2, top + 16);
      ctx.lineTo(-bw / 2 - 2, top + bh - 2);
      ctx.lineTo(bw / 2 + 2, top + bh - 2);
      ctx.lineTo(bw / 2, top + 16);
      ctx.quadraticCurveTo(0, top + 8, -bw / 2, top + 16);
      ctx.fill();
      // lapels
      ctx.fillStyle = "#0e141c";
      ctx.beginPath();
      ctx.moveTo(-2, top + 14);
      ctx.lineTo(-12, top + bh - 6);
      ctx.lineTo(-4, top + bh - 6);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(2, top + 14);
      ctx.lineTo(12, top + bh - 6);
      ctx.lineTo(4, top + bh - 6);
      ctx.closePath();
      ctx.fill();
      // shirt
      ctx.fillStyle = COLORS.shirt;
      ctx.beginPath();
      ctx.moveTo(0, top + 12);
      ctx.lineTo(6, top + bh - 8);
      ctx.lineTo(-6, top + bh - 8);
      ctx.closePath();
      ctx.fill();
      // tie
      ctx.fillStyle = COLORS.tie;
      ctx.beginPath();
      ctx.moveTo(-2.5, top + 16);
      ctx.lineTo(2.5, top + 16);
      ctx.lineTo(4.5, top + bh - 12);
      ctx.lineTo(0, top + bh - 6);
      ctx.lineTo(-4.5, top + bh - 12);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#8e241c";
      ctx.beginPath();
      ctx.moveTo(-3, top + 16);
      ctx.lineTo(3, top + 16);
      ctx.lineTo(0, top + 22);
      ctx.closePath();
      ctx.fill();

      // pistol
      ctx.fillStyle = "#141416";
      ctx.fillRect(bw / 2 - 4, -1, 16, 5);
      ctx.fillRect(bw / 2 + 8, -3, 5, 4);
      if (this.muzzle > 0) {
        ctx.fillStyle = "rgba(255, 230, 160, 0.9)";
        ctx.beginPath();
        ctx.arc(bw / 2 + 22, 1, 6 + this.muzzle * 20, 0, Math.PI * 2);
        ctx.fill();
      }

      // head
      ctx.fillStyle = COLORS.skin;
      ctx.beginPath();
      ctx.ellipse(1, top - 6, 12, 13, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#c99570";
      ctx.beginPath();
      ctx.ellipse(6, top - 2, 4, 6, 0.2, 0, Math.PI * 2);
      ctx.fill();
      // hair
      ctx.fillStyle = COLORS.hair;
      ctx.beginPath();
      ctx.ellipse(-1, top - 16, 15, 8, -0.15, Math.PI * 0.9, Math.PI * 2.15);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-12, top - 12);
      ctx.quadraticCurveTo(-18, top - 2, -6, top);
      ctx.quadraticCurveTo(-14, top - 8, -10, top - 14);
      ctx.fill();
      // brow + eye
      ctx.fillStyle = "#3a3028";
      ctx.fillRect(0, top - 8, 9, 1.6);
      ctx.fillStyle = "#1a1814";
      ctx.beginPath();
      ctx.ellipse(7, top - 5, 2.2, 1.6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#f4f4f5";
      ctx.fillRect(6.2, top - 5.6, 1, 1);

      // legs
      const swing = Math.sin(this.runPhase) * (this.onGround && this.phase === "playing" ? 9 : 4);
      ctx.strokeStyle = "#121820";
      ctx.lineWidth = 5;
      ctx.lineCap = "round";
      ctx.beginPath();
      if (this.onGround && this.phase === "playing") {
        ctx.moveTo(-6, top + bh - 2);
        ctx.lineTo(-8 + swing, top + bh + 14);
        ctx.moveTo(6, top + bh - 2);
        ctx.lineTo(8 - swing, top + bh + 14);
      } else {
        ctx.moveTo(-6, top + bh - 2);
        ctx.lineTo(-12, top + bh + 10);
        ctx.moveTo(6, top + bh - 2);
        ctx.lineTo(10, top + bh + 8);
      }
      ctx.stroke();
      ctx.fillStyle = "#0c0c0e";
      if (this.onGround && this.phase === "playing") {
        ctx.fillRect(-12 + swing, top + bh + 12, 8, 3);
        ctx.fillRect(4 - swing, top + bh + 12, 8, 3);
      }
    } else {
      ctx.fillStyle = "#1b2433";
      ctx.beginPath();
      ctx.roundRect(-18, -8, 36, 16, 6);
      ctx.fill();
      ctx.fillStyle = COLORS.tie;
      ctx.fillRect(-4, -6, 6, 12);
      ctx.fillStyle = COLORS.skin;
      ctx.beginPath();
      ctx.ellipse(16, -2, 11, 8, 0.15, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = COLORS.hair;
      ctx.beginPath();
      ctx.ellipse(16, -9, 13, 6, 0.1, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }
  private drawParticles(ctx: CanvasRenderingContext2D) {
    for (const p of this.particles) {
      if (!p.active) continue;
      const a = clamp(p.life / p.maxLife, 0, 1);
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * a, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  private drawFloats(ctx: CanvasRenderingContext2D) {
    ctx.font = "600 16px Segoe UI, system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    for (const f of this.floats) {
      if (!f.active) continue;
      const a = clamp(f.life / f.maxLife, 0, 1);
      ctx.globalAlpha = a;
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;
  }
}
