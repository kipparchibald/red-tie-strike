import { useCallback, useEffect, useRef, useState, type PointerEvent, type ReactNode } from "react";
import { RunnerEngine, type HudSnapshot, type RunMode } from "@/game/runnerEngine";
import { formatSeasonCompact } from "@/game/seasonHud";
import {
  contestShareText,
  emptyContestSnapshot,
  formatWeekLeft,
  getOrCreatePlayerId,
  loadNickname,
  listWeekCourses,
  saveNickname,
  type ContestSnapshot,
} from "@/game/contest";
import { getContestFn, submitContestScoreFn } from "@/game/contest.functions";
import { sanitizeNickname } from "@/game/profanity";
import {
  BOARDS,
  loadMeta,
  saveMeta,
  SKINS,
  tryUnlock,
  updateMissionsAfterRun,
  type MetaSave,
} from "@/game/runnerMeta";
import { DEFAULT_SETTINGS, KEY_SCHEMES, loadSettings, saveSettings, type GameSettings, type Pace } from "@/game/storage";
import { setRunnerMuted } from "@/game/runnerAudio";
import { missionProgress } from "@/game/runnerScoring";
import { RARITY } from "@/game/runnerToon";
import { CharacterShowcase } from "@/components/CharacterShowcase";
import { Check, ChevronDown, ChevronUp, RotateCcw, Share2, Sparkles, Volume2, VolumeX } from "lucide-react";

const INITIAL_HUD: HudSnapshot = {
  phase: "ready",
  score: 0,
  highScore: 0,
  combo: 0,
  maxCombo: 0,
  intercepts: 0,
  speed: 320,
  speedNorm: 0,
  distance: 0,
  isNewRecord: false,
  lastComboBonus: 0,
  fireReady: true,
  lives: 3,
  coins: 0,
  form: "normal",
  flare: 0,
  magnetTimer: 0,
  doubleCoinTimer: 0,
  skin: "default",
  board: "classic",
  boosting: false,
  sliding: false,
  jumpHeld: false,
  tutorialStep: -1,
  tutorialTitle: "",
  tutorialKey: "",
  tutorialTouch: "",
  mode: "free",
  beatTarget: 0,
  beatMet: false,
  hops: 0,
  slides: 0,
  auto: false,
  courseDay: 0,
  courseLabel: "",
  tourDone: false,
};

export function EndlessRunner() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<RunnerEngine | null>(null);
  const [hud, setHud] = useState<HudSnapshot>(INITIAL_HUD);
  const [mounted, setMounted] = useState(false);
  const [contest, setContest] = useState<ContestSnapshot>(emptyContestSnapshot);
  const [meta, setMeta] = useState<MetaSave | null>(null);
  const [shareState, setShareState] = useState<"idle" | "copied">("idle");
  const [beatInput, setBeatInput] = useState("1000");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [shopOpen, setShopOpen] = useState(false);
  const [settings, setSettings] = useState<GameSettings>(DEFAULT_SETTINGS);
  const [nickname, setNickname] = useState("Rider");
  const [seasonClock, setSeasonClock] = useState("--");
  const playerIdRef = useRef<string>("");
  const lastSubmittedRef = useRef(0);

  useEffect(() => {
    const tick = () => setSeasonClock(formatSeasonCompact());
    tick();
    const id = window.setInterval(tick, 500);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const loadedMeta = loadMeta();
    setMeta(loadedMeta);
    const nick = sanitizeNickname(loadNickname() || "Rider");
    setNickname(nick);

    const engine = new RunnerEngine(canvas, {
      onHud: (next) => setHud(next),
      onRunEnd: (snap) => {
        const nextMeta = updateMissionsAfterRun({
          coins: snap.coins,
          maxCombo: snap.maxCombo,
          score: snap.score,
          mode: snap.mode,
        });
        nextMeta.bankCoins += snap.coins;
        saveMeta(nextMeta);
        setMeta({ ...nextMeta });
      },
    });
    engine.setCosmetics(loadedMeta.skin, loadedMeta.board);
    engineRef.current = engine;
    engine.start();
    setMounted(true);

    const pid = getOrCreatePlayerId();
    playerIdRef.current = pid;
    const fromUrl = new URLSearchParams(window.location.search).get("beat");
    const parsed = fromUrl ? parseInt(fromUrl, 10) : 0;
    if (parsed > 0) setBeatInput(String(parsed));
    const s = loadSettings();
    setSettings(s);
    setRunnerMuted(s.mute);

    getContestFn({ data: { playerId: pid, nickname: nick } })
      .then(setContest)
      .catch(() => {});

    const onResize = () => engine.resize();
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("resize", onResize);
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!meta) return;
    engineRef.current?.setCosmetics(meta.skin, meta.board);
  }, [meta?.skin, meta?.board]);

  const onJump = useCallback(() => engineRef.current?.pressJump(), []);
  const onJumpUp = useCallback(() => engineRef.current?.releaseJump(), []);
  const onBoostDown = useCallback(() => engineRef.current?.pressBoost(true), []);
  const onBoostUp = useCallback(() => engineRef.current?.pressBoost(false), []);
  const onSlideDown = useCallback(() => engineRef.current?.pressSlide(true), []);
  const onSlideUp = useCallback(() => engineRef.current?.pressSlide(false), []);
  const onFire = useCallback(() => engineRef.current?.pressFire(), []);
  const onRestart = useCallback(() => engineRef.current?.restart(), []);
  const onStart = useCallback(() => engineRef.current?.beginRun(), []);
  const onPractice = useCallback(() => engineRef.current?.startTutorial(), []);
  const onWatch = useCallback(() => engineRef.current?.watchAll(), []);
  const onPlayCourse = useCallback((day: number) => engineRef.current?.playCourse(day), []);
  const onStopTour = useCallback(() => engineRef.current?.stopTour(), []);

  const onChangeSettings = useCallback((next: GameSettings) => {
    setSettings(next);
    saveSettings(next);
    setRunnerMuted(next.mute);
    engineRef.current?.setSettings(next);
  }, []);

  const onChallenge = useCallback(
    (mode: RunMode) => {
      const beat = mode === "beat" ? parseInt(beatInput, 10) || 0 : 0;
      engineRef.current?.startChallenge(mode, beat);
    },
    [beatInput],
  );

  const onNicknameBlur = useCallback(() => {
    const safe = sanitizeNickname(nickname);
    setNickname(safe);
    saveNickname(safe);
    const pid = playerIdRef.current;
    if (pid) {
      getContestFn({ data: { playerId: pid, nickname: safe } })
        .then(setContest)
        .catch(() => {});
    }
  }, [nickname]);

  useEffect(() => {
    if (hud.phase !== "dead") return;
    const pid = playerIdRef.current;
    if (!pid || hud.score <= 0) return;
    if (hud.mode === "free") return;
    if (hud.score === lastSubmittedRef.current) return;
    lastSubmittedRef.current = hud.score;
    submitContestScoreFn({ data: { playerId: pid, score: hud.score, nickname: sanitizeNickname(nickname) } })
      .then(setContest)
      .catch(() => {});
  }, [hud.phase, hud.score, hud.mode, nickname]);

  const onShare = useCallback(async () => {
    const missions = `${missionProgress(hud.hops, hud.slides, hud.intercepts)}/3 missions`;
    const text = contestShareText(hud.score || contest.yourScore, missions, hud.score || contest.yourScore);
    try {
      if (navigator.share) {
        await navigator.share({ title: "Neon Alley Dash", text });
      } else {
        await navigator.clipboard.writeText(text);
      }
      setShareState("copied");
      window.setTimeout(() => setShareState("idle"), 1800);
    } catch {
      try {
        await navigator.clipboard.writeText(text);
        setShareState("copied");
        window.setTimeout(() => setShareState("idle"), 1800);
      } catch {
        /* ignore */
      }
    }
  }, [contest.yourScore, hud]);

  const onUnlock = useCallback((id: string, kind: "skin" | "board") => {
    const item = (kind === "skin" ? SKINS : BOARDS).find((i) => i.id === id);
    if (!item) return;
    const result = tryUnlock(item);
    setMeta({ ...result.meta });
  }, []);

  const bankCoins = meta?.bankCoins ?? 0;
  const missions = meta?.missions ?? [];

  return (
    <div className="relative flex h-dvh w-full flex-col items-center justify-center overflow-hidden bg-bg">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-90"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 78% 22%, color-mix(in oklab, #7c5cff 18%, transparent), transparent 60%), radial-gradient(ellipse 70% 50% at 12% 88%, color-mix(in oklab, #ff6b9d 14%, transparent), transparent)",
        }}
      />

      <div className="relative z-10 flex h-full w-full max-w-[1100px] flex-col px-3 py-3 sm:px-5 sm:py-4">
        <header className="mb-2 flex shrink-0 items-start justify-between gap-3 sm:mb-3">
          <div>
            <p className="text-[0.7rem] font-medium tracking-[0.18em] text-fg-subtle uppercase">Neighborhood runner</p>
            <h1 className="font-display text-2xl tracking-wide text-fg sm:text-3xl">Neon Alley Dash</h1>
          </div>

          <div className="flex flex-wrap items-start justify-end gap-2 sm:gap-3">
            <HudChip
              label={hud.phase === "playing" && hud.mode !== "free" ? "Missions" : "Season"}
              value={
                hud.phase === "playing" && hud.mode !== "free"
                  ? `${missionProgress(hud.hops, hud.slides, hud.intercepts)}/3`
                  : seasonClock
              }
              emphasize
            />
            {!mounted && <HudChip label="Loading" value="…" />}
            {mounted && hud.phase !== "ready" && (
              <>
                <HudChip label="Lives" value={String(hud.lives)} emphasize />
                <HudChip label="Stars" value={String(hud.coins)} />
                <HudChip label="Saved" value={String(bankCoins)} />
                {hud.magnetTimer > 0.2 && <HudChip label="Magnet" value={`${Math.ceil(hud.magnetTimer)}s`} accent />}
                {hud.doubleCoinTimer > 0.2 && (
                  <HudChip label="2×" value={`${Math.ceil(hud.doubleCoinTimer)}s`} accent />
                )}
                {hud.form !== "normal" && (
                  <HudChip label="Power" value={hud.form === "sidearm" ? "Zap" : "Shield"} accent />
                )}
                {hud.flare > 0.2 && <HudChip label="Boost" value={`${Math.ceil(hud.flare)}s`} accent />}
                <HudChip label="Best" value={Math.max(hud.highScore, hud.score).toLocaleString()} />
                <HudChip label="Pops" value={String(hud.intercepts)} />
                {hud.combo >= 1 && <HudChip label="Combo" value={`×${hud.combo}`} accent />}
                <SpeedMeter value={hud.speedNorm} />
              </>
            )}
          </div>
        </header>

        <div className="relative min-h-0 flex-1">
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="relative aspect-[16/9] h-full max-h-full w-full max-w-full overflow-hidden rounded-xl border border-border bg-bg-elevated shadow-[0_24px_80px_rgba(0,0,0,0.35)] sm:rounded-2xl">
              <canvas
                ref={canvasRef}
                className="block h-full w-full touch-none select-none"
                style={{ touchAction: "none" }}
                aria-label="Neon Alley Dash game canvas"
              />

              {hud.phase === "ready" && (
                <div className="absolute inset-0 flex flex-col items-center justify-center overflow-y-auto bg-[color-mix(in_oklab,var(--color-bg)_50%,transparent)] px-5 py-8 text-center backdrop-blur-[2px] sm:px-6">
                  <p className="mb-1 text-[0.7rem] font-medium tracking-[0.2em] text-fg-subtle uppercase">
                    Best {hud.highScore.toLocaleString()}
                  </p>
                  <h2 className="font-display mb-2 text-4xl tracking-wide text-fg sm:text-5xl">Ride the neon alley</h2>
                  <p className="mb-4 max-w-md text-sm text-fg-muted">
                    Hop rooftops, slide under barriers, pop floaty bots, and chase combos with your pet buddy. No ads. No
                    real-money shop — just coins you earn in-game.
                  </p>

                  <div className="mb-3 w-full max-w-sm">
                    <label className="text-left text-[0.65rem] font-medium tracking-[0.16em] text-fg-subtle uppercase">
                      Nickname (leaderboard only)
                    </label>
                    <input
                      value={nickname}
                      onChange={(e) => setNickname(e.target.value.slice(0, 16))}
                      onBlur={onNicknameBlur}
                      className="mt-1 min-h-10 w-full rounded-xl border border-border bg-bg-elevated px-3 text-sm text-fg"
                      aria-label="Nickname"
                    />
                  </div>

                  <div className="mb-4 w-full max-w-sm rounded-2xl border border-border bg-bg-elevated/90 px-4 py-3 text-left sm:px-5">
                    <p className="text-[0.65rem] font-medium tracking-[0.16em] text-fg-subtle uppercase">Weekly season</p>
                    <p className="mt-1 text-xs leading-relaxed text-fg-muted">
                      One shared course each day — fair scores for everyone. Season ends in {formatWeekLeft(contest.endsAt)}.
                    </p>
                    {contest.leaderScore > 0 && (
                      <p className="mt-2 text-xs text-fg">
                        Week best {contest.leaderScore.toLocaleString()}
                        {contest.youLead ? " — yours!" : ""}
                      </p>
                    )}
                    {contest.top.length > 0 && (
                      <ul className="mt-2 space-y-1 text-xs text-fg-muted">
                        {contest.top.map((row, i) => (
                          <li key={`${row.nickname}-${i}`} className="flex justify-between gap-2">
                            <span>
                              {i + 1}. {row.nickname}
                            </span>
                            <span className="font-mono tabular-nums">{row.score.toLocaleString()}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {missions.length > 0 && !shopOpen && !settingsOpen && (
                    <div className="mb-4 w-full max-w-sm rounded-2xl border border-border bg-bg-elevated/90 px-4 py-3 text-left">
                      <p className="text-[0.65rem] font-medium tracking-[0.16em] text-fg-subtle uppercase">Daily missions</p>
                      <ul className="mt-2 space-y-2 text-xs">
                        {missions.map((m) => (
                          <li key={m.id} className={m.done ? "text-fg-muted line-through" : "text-fg"}>
                            {m.label}
                            {!m.done && (
                              <span className="text-fg-subtle">
                                {" "}
                                · {Math.min(m.progress, m.target)}/{m.target}
                              </span>
                            )}
                            {m.done && <span className="text-fg-subtle"> · +{m.reward} coins</span>}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {shopOpen ? (
                    <ShopPanel bankCoins={bankCoins} meta={meta} onClose={() => setShopOpen(false)} onUnlock={onUnlock} />
                  ) : settingsOpen ? (
                    <SettingsPanel settings={settings} onChange={onChangeSettings} onClose={() => setSettingsOpen(false)} />
                  ) : (
                    <div className="flex w-full max-w-sm flex-col gap-2">
                      <button
                        type="button"
                        onClick={() => onChallenge("weekly")}
                        className="min-h-11 rounded-full bg-accent px-8 py-3 text-sm font-semibold text-accent-fg active:scale-[0.98]"
                      >
                        Today&apos;s course
                      </button>
                      {mounted && (
                        <div className="flex flex-wrap justify-center gap-1">
                          {listWeekCourses().map((course) => (
                            <button
                              key={course.day}
                              type="button"
                              onClick={() => onPlayCourse(course.day)}
                              className={`rounded-full border px-2.5 py-1 text-[0.7rem] font-semibold ${
                                course.today
                                  ? "border-accent bg-accent text-accent-fg"
                                  : "border-border bg-bg-elevated text-fg-muted"
                              }`}
                            >
                              {course.label}
                            </button>
                          ))}
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={onWatch}
                        className="min-h-11 rounded-full border border-border bg-bg-elevated px-6 py-3 text-sm font-semibold text-fg active:scale-[0.98]"
                      >
                        Watch all 7
                      </button>
                      <div className="flex gap-2">
                        <input
                          inputMode="numeric"
                          aria-label="Score to beat"
                          value={beatInput}
                          onChange={(e) => setBeatInput(e.target.value.replace(/[^\d]/g, "").slice(0, 7))}
                          className="min-h-11 w-28 rounded-full border border-border bg-bg-elevated px-4 text-center font-mono text-sm text-fg"
                        />
                        <button
                          type="button"
                          onClick={() => onChallenge("beat")}
                          className="min-h-11 flex-1 rounded-full border border-border bg-bg-elevated px-4 text-sm font-semibold text-fg active:scale-[0.98]"
                        >
                          Beat this score
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => onChallenge("free")}
                        className="min-h-11 rounded-full border border-border bg-bg-elevated px-6 py-3 text-sm font-semibold text-fg active:scale-[0.98]"
                      >
                        Free ride
                      </button>
                      <button type="button" onClick={onPractice} className="min-h-11 text-sm font-semibold text-fg-muted">
                        Practice controls
                      </button>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setShopOpen(true)}
                          className="min-h-11 flex-1 rounded-full border border-border bg-bg-elevated text-sm font-semibold text-fg"
                        >
                          Skins & boards ({bankCoins} coins)
                        </button>
                        <button
                          type="button"
                          onClick={() => setSettingsOpen(true)}
                          className="min-h-11 flex-1 rounded-full border border-border bg-bg-elevated text-sm font-semibold text-fg"
                        >
                          Settings
                        </button>
                      </div>
                    </div>
                  )}
                  <p className="mt-3 text-xs text-fg-subtle">
                    Season missions: 3 rooftop hops, 3 slides, 3 bot pops · Swipe on mobile
                  </p>
                </div>
              )}

              {hud.auto && hud.phase === "playing" && (
                <div className="pointer-events-none absolute inset-x-3 top-12 z-20 sm:inset-x-4">
                  <div className="pointer-events-auto flex items-center justify-between gap-3 rounded-xl border border-border bg-bg-elevated/95 px-3 py-2.5">
                    <div>
                      <p className="text-[0.65rem] font-medium tracking-[0.16em] text-fg-subtle uppercase">
                        Watching {hud.courseDay + 1} of 7
                      </p>
                      <p className="text-sm font-semibold text-fg">{hud.courseLabel}</p>
                    </div>
                    <button
                      type="button"
                      onClick={onStopTour}
                      className="rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-fg-muted"
                    >
                      Stop
                    </button>
                  </div>
                </div>
              )}

              {hud.phase === "playing" && hud.tutorialStep >= 0 && hud.tutorialStep < 6 && (
                <div className="pointer-events-none absolute inset-x-3 top-12 z-20 sm:inset-x-4">
                  <div className="pointer-events-auto rounded-xl border border-border bg-bg-elevated/95 px-3 py-2.5 shadow-lg">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[0.65rem] font-medium tracking-[0.16em] text-fg-subtle uppercase">
                          Lesson {hud.tutorialStep + 1} of 6
                        </p>
                        <p className="text-sm font-semibold text-fg">{hud.tutorialTitle}</p>
                        <p className="text-xs text-fg-muted md:hidden">{hud.tutorialTouch}</p>
                        <p className="hidden text-xs text-fg-muted md:block">{hud.tutorialKey}</p>
                      </div>
                      <button
                        type="button"
                        onClick={onStart}
                        className="shrink-0 rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-fg-muted"
                      >
                        Skip
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {hud.phase === "playing" && hud.tutorialStep >= 6 && (
                <div className="absolute inset-0 z-20 flex items-center justify-center bg-[color-mix(in_oklab,var(--color-bg)_55%,transparent)] px-6">
                  <div className="w-full max-w-sm rounded-2xl border border-border bg-bg-elevated p-6 text-center">
                    <p className="text-[0.7rem] font-medium tracking-[0.16em] text-fg-subtle uppercase">Lesson complete</p>
                    <h2 className="mt-1 text-2xl font-semibold text-fg">You&apos;re ready to roll</h2>
                    <p className="mt-2 text-sm text-fg-muted">Hold boost for big jumps between rooftops. Miss a landing and you lose a life.</p>
                    <button
                      type="button"
                      onClick={onStart}
                      className="mt-4 min-h-11 w-full rounded-full bg-accent px-6 py-3 text-sm font-semibold text-accent-fg"
                    >
                      Let&apos;s go!
                    </button>
                  </div>
                </div>
              )}

              {hud.phase === "dead" && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-[color-mix(in_oklab,var(--color-bg)_62%,transparent)] px-6 text-center backdrop-blur-[3px]">
                  <div className="w-full max-w-sm rounded-2xl border border-border bg-bg-elevated/95 p-6 shadow-[0_16px_48px_rgba(0,0,0,0.35)] sm:p-8">
                    {hud.isNewRecord && (
                      <p className="font-display victory-emote mb-3 flex items-center justify-center gap-2 text-3xl text-accent">
                        <Sparkles className="size-6" aria-hidden />
                        WOO-HOO!
                        <Sparkles className="size-6" aria-hidden />
                      </p>
                    )}
                    <p className="mb-1 text-[0.7rem] font-medium tracking-[0.18em] text-fg-subtle uppercase">Run over</p>
                    <h2 className="font-display mb-1 text-3xl tracking-wide text-fg sm:text-4xl">
                      {hud.isNewRecord ? "Legendary run!" : "Nice try!"}
                    </h2>
                    <p className="mb-4 text-xs text-fg-muted">
                      {hud.mode === "beat"
                        ? hud.beatMet
                          ? `Beat ${hud.beatTarget.toLocaleString()}`
                          : `Short of ${hud.beatTarget.toLocaleString()}`
                        : hud.mode === "weekly"
                          ? `Missions ${missionProgress(hud.hops, hud.slides, hud.intercepts)}/3`
                          : "Free ride"}
                      {contest.leaderScore > 0 ? ` · week best ${contest.leaderScore.toLocaleString()}` : ""}
                    </p>

                    <div className="mb-6 grid grid-cols-2 gap-3">
                      <StatCard label="Score" value={hud.score.toLocaleString()} />
                      <StatCard label="Best" value={hud.highScore.toLocaleString()} />
                      <StatCard label="Stars run" value={String(hud.coins)} />
                      <StatCard
                        label="Season"
                        value={seasonClock}
                      />
                    </div>

                    <div className="flex flex-col gap-2">
                      <button
                        type="button"
                        onClick={onShare}
                        className="flex min-h-11 w-full items-center justify-center gap-2 rounded-full border border-border bg-bg-subtle px-6 py-3 text-sm font-semibold text-fg active:scale-[0.98]"
                      >
                        {shareState === "copied" ? <Check className="size-4" /> : <Share2 className="size-4" />}
                        {shareState === "copied" ? "Challenge copied" : "Share score"}
                      </button>
                      <button
                        type="button"
                        onClick={onRestart}
                        className="flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-accent px-6 py-3 text-sm font-semibold text-accent-fg active:scale-[0.98]"
                      >
                        <RotateCcw className="size-4" />
                        Ride again
                      </button>
                    </div>
                    <p className="mt-3 text-xs text-fg-subtle">Space or Enter to restart</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="mt-3 grid shrink-0 grid-cols-[1fr_1.2fr] gap-2">
          <div className="grid grid-rows-2 gap-2">
            <button
              type="button"
              {...holdButton(onBoostDown, onBoostUp)}
              className={`flex min-h-16 flex-col items-center justify-center rounded-2xl border text-sm font-semibold ${
                hud.boosting ? "border-accent bg-accent text-accent-fg" : "border-border bg-bg-elevated text-fg"
              }`}
            >
              Boost
              <span className={`mt-0.5 block font-mono text-[0.65rem] font-medium ${hud.boosting ? "text-accent-fg/80" : "text-fg-muted"}`}>
                {KEY_SCHEMES[settings.keys].runLabel}
              </span>
            </button>
            <button
              type="button"
              {...holdButton(onSlideDown, onSlideUp)}
              className={`flex min-h-16 flex-col items-center justify-center rounded-2xl border text-sm font-semibold ${
                hud.sliding ? "border-accent bg-accent text-accent-fg" : "border-border bg-bg-elevated text-fg"
              }`}
            >
              <span className="flex items-center gap-1">
                <ChevronDown className="size-4" aria-hidden />
                Slide
              </span>
              <span className={`font-mono text-[0.65rem] font-medium ${hud.sliding ? "text-accent-fg/80" : "text-fg-muted"}`}>
                {KEY_SCHEMES[settings.keys].slideLabel}
              </span>
            </button>
          </div>
          <div className="grid grid-rows-[1.4fr_0.8fr] gap-2">
            <button
              type="button"
              {...holdButton(onJump, onJumpUp)}
              className={`flex min-h-20 flex-col items-center justify-center rounded-2xl border text-base font-semibold ${
                hud.jumpHeld ? "border-accent bg-accent text-accent-fg" : "border-border bg-bg-elevated text-fg"
              }`}
            >
              <span className="flex items-center gap-2">
                <ChevronUp className="size-5" aria-hidden />
                Jump
              </span>
              <span className={`font-mono text-[0.65rem] font-medium ${hud.jumpHeld ? "text-accent-fg/80" : "text-fg-muted"}`}>
                {KEY_SCHEMES[settings.keys].jumpLabel}
              </span>
            </button>
            <button
              type="button"
              onPointerDown={(e) => {
                e.preventDefault();
                onFire();
              }}
              className={`flex min-h-12 flex-col items-center justify-center rounded-2xl border text-sm font-semibold ${
                hud.fireReady ? "border-border bg-bg-elevated text-fg" : "border-border bg-bg-subtle text-fg-muted"
              }`}
            >
              Pop
              <span className="font-mono text-[0.65rem] font-medium text-fg-muted">{KEY_SCHEMES[settings.keys].fireLabel}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SettingsPanel({
  settings,
  onChange,
  onClose,
}: {
  settings: GameSettings;
  onChange: (s: GameSettings) => void;
  onClose: () => void;
}) {
  return (
    <div className="flex w-full max-w-sm flex-col gap-3 rounded-2xl border border-border bg-bg-elevated/90 px-4 py-3 text-left">
      <p className="text-[0.65rem] font-medium tracking-[0.16em] text-fg-subtle uppercase">Settings</p>
      <SettingRow label="Lives">
        {([1, 3, 5] as const).map((n) => (
          <Choice key={n} on={settings.lives === n} onClick={() => onChange({ ...settings, lives: n })}>
            {n}
          </Choice>
        ))}
      </SettingRow>
      <SettingRow label="Pace">
        {(["slow", "normal", "fast"] as Pace[]).map((pace) => (
          <Choice key={pace} on={settings.pace === pace} onClick={() => onChange({ ...settings, pace })}>
            {pace}
          </Choice>
        ))}
      </SettingRow>
      <SettingRow label="Keys">
        {(
          [
            ["arrows", "Arrows"],
            ["wasd", "WASD"],
            ["all", "All"],
          ] as const
        ).map(([id, label]) => (
          <Choice key={id} on={settings.keys === id} onClick={() => onChange({ ...settings, keys: id })}>
            {label}
          </Choice>
        ))}
      </SettingRow>
      <SettingRow label="Screen shake">
        <Choice on={settings.shake} onClick={() => onChange({ ...settings, shake: true })}>
          On
        </Choice>
        <Choice on={!settings.shake} onClick={() => onChange({ ...settings, shake: false })}>
          Off
        </Choice>
      </SettingRow>
      <SettingRow label="Sound">
        <Choice on={!settings.mute} onClick={() => onChange({ ...settings, mute: false })}>
          <Volume2 className="size-3.5" aria-hidden />
        </Choice>
        <Choice on={settings.mute} onClick={() => onChange({ ...settings, mute: true })}>
          <VolumeX className="size-3.5" aria-hidden />
        </Choice>
      </SettingRow>
      <p className="text-xs leading-relaxed text-fg-muted">
        Lives and pace apply to Free ride and Practice. Today&apos;s course uses 3 lives and normal pace so scores stay fair.
      </p>
      <button type="button" onClick={onClose} className="min-h-11 rounded-full bg-accent text-sm font-semibold text-accent-fg">
        Done
      </button>
    </div>
  );
}

function ShopPanel({
  bankCoins,
  meta,
  onClose,
  onUnlock,
}: {
  bankCoins: number;
  meta: MetaSave | null;
  onClose: () => void;
  onUnlock: (id: string, kind: "skin" | "board") => void;
}) {
  const equippedSkin = meta?.skin ?? "default";
  const equippedBoard = meta?.board ?? "classic";
  return (
    <div className="toon-panel flex w-full max-w-sm flex-col gap-3 rounded-2xl bg-bg-elevated/95 px-4 py-3 text-left">
      <p className="font-display text-xl tracking-wide text-fg">Locker</p>
      <CharacterShowcase skin={equippedSkin} board={equippedBoard} />
      <p className="text-xs text-fg-muted">Vault: {bankCoins} coins · unlock with stars from runs & missions.</p>
      <p className="text-xs font-semibold text-fg">Outfits</p>
      {SKINS.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onUnlock(item.id, "skin")}
          style={{ borderColor: RARITY[item.rarity].fill }}
          className={`flex min-h-10 items-center justify-between rounded-xl border-2 px-3 text-sm shadow-[0_3px_0_#1a1028] ${
            equippedSkin === item.id ? "bg-accent/15" : "bg-bg-subtle/40"
          }`}
        >
          <span>
            {item.label}{" "}
            <span className="text-[0.65rem] uppercase" style={{ color: RARITY[item.rarity].glow }}>
              {RARITY[item.rarity].label}
            </span>
          </span>
          <span className="text-xs text-fg-muted">{item.cost === 0 ? "Free" : `${item.cost} coins`}</span>
        </button>
      ))}
      <p className="text-xs font-semibold text-fg">Boards</p>
      {BOARDS.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onUnlock(item.id, "board")}
          style={{ borderColor: RARITY[item.rarity].fill }}
          className={`flex min-h-10 items-center justify-between rounded-xl border-2 px-3 text-sm shadow-[0_3px_0_#1a1028] ${
            equippedBoard === item.id ? "bg-accent/15" : "bg-bg-subtle/40"
          }`}
        >
          <span>
            {item.label}{" "}
            <span className="text-[0.65rem] uppercase" style={{ color: RARITY[item.rarity].glow }}>
              {RARITY[item.rarity].label}
            </span>
          </span>
          <span className="text-xs text-fg-muted">{item.cost === 0 ? "Free" : `${item.cost} coins`}</span>
        </button>
      ))}
      <button
        type="button"
        onClick={onClose}
        className="font-display min-h-11 rounded-full bg-accent text-lg tracking-wide text-accent-fg shadow-[0_4px_0_#1a1028]"
      >
        Back to lobby
      </button>
    </div>
  );
}

function SettingRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm text-fg">{label}</span>
      <div className="flex gap-1">{children}</div>
    </div>
  );
}

function Choice({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-h-9 items-center justify-center rounded-full px-3 text-xs font-semibold capitalize ${
        on ? "bg-accent text-accent-fg" : "border border-border text-fg-muted"
      }`}
    >
      {children}
    </button>
  );
}

function holdButton(down: () => void, up: () => void) {
  return {
    onPointerDown: (e: PointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      down();
    },
    onPointerUp: (e: PointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      up();
    },
    onPointerCancel: () => up(),
  };
}

function HudChip({
  label,
  value,
  emphasize,
  accent,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
  accent?: boolean;
}) {
  return (
    <div
      className={`min-w-[4.5rem] rounded-lg border px-2.5 py-1.5 sm:min-w-[5.5rem] sm:rounded-xl sm:px-3 sm:py-2 ${
        accent ? "border-warn/40 bg-warn/10" : "border-border bg-bg-elevated/90"
      }`}
    >
      <p className="text-[0.65rem] font-medium tracking-wide text-fg-subtle uppercase">{label}</p>
      <p
        className={`font-mono text-sm font-semibold tabular-nums sm:text-base ${
          emphasize ? "text-fg" : accent ? "text-warn" : "text-fg-muted"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function SpeedMeter({ value }: { value: number }) {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);
  return (
    <div className="min-w-[5.5rem] rounded-lg border border-border bg-bg-elevated/90 px-2.5 py-1.5 sm:min-w-[6.5rem] sm:rounded-xl sm:px-3 sm:py-2">
      <p className="text-[0.65rem] font-medium tracking-wide text-fg-subtle uppercase">Speed</p>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-bg-subtle">
        <div
          className="h-full rounded-full bg-accent transition-[width] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-bg-subtle/80 px-3 py-3 text-left">
      <p className="text-[0.65rem] font-medium tracking-wide text-fg-subtle uppercase">{label}</p>
      <p className="mt-0.5 font-mono text-lg font-semibold tabular-nums text-fg">{value}</p>
    </div>
  );
}
