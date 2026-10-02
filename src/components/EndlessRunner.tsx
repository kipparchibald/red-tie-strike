import { useCallback, useEffect, useRef, useState, type PointerEvent, type ReactNode } from "react";
import { RunnerEngine, type HudSnapshot, type RunMode } from "@/game/runnerEngine";
import {
  formatMidtermCompact,
  getMidtermRemaining,
  type MidtermRemaining,
} from "@/game/midtermClock";
import {
  contestShareText,
  emptyContestSnapshot,
  formatWeekLeft,
  getContestWeek,
  getOrCreatePlayerId,
  listWeekCourses,
  type ContestSnapshot,
} from "@/game/contest";
import { getContestFn, submitContestScoreFn } from "@/game/contest.functions";
import { DEFAULT_SETTINGS, loadSettings, type GameSettings, type Pace } from "@/game/storage";
import { Check, ChevronDown, ChevronUp, Crosshair, RotateCcw, Share2 } from "lucide-react";

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
  const clock = useMidtermClock();
  const [contest, setContest] = useState<ContestSnapshot>(emptyContestSnapshot);
  const [shareState, setShareState] = useState<"idle" | "copied">("idle");
  const [beatInput, setBeatInput] = useState("1000");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] = useState<GameSettings>(DEFAULT_SETTINGS);
  const playerIdRef = useRef<string>("");
  const lastSubmittedRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const engine = new RunnerEngine(canvas, {
      onHud: (next) => setHud(next),
    });
    engineRef.current = engine;
    engine.start();
    setMounted(true);

    const pid = getOrCreatePlayerId();
    playerIdRef.current = pid;
    const fromUrl = new URLSearchParams(window.location.search).get("beat");
    const parsed = fromUrl ? parseInt(fromUrl, 10) : 0;
    if (parsed > 0) setBeatInput(String(parsed));
    setSettings(loadSettings());
    getContestFn({ data: { playerId: pid } })
      .then(setContest)
      .catch(() => {
        /* contest board is optional */
      });

    const onResize = () => engine.resize();
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("resize", onResize);
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  const onJump = useCallback(() => {
    engineRef.current?.pressJump();
  }, []);

  const onJumpUp = useCallback(() => {
    engineRef.current?.releaseJump();
  }, []);

  const onBoostDown = useCallback(() => {
    engineRef.current?.pressBoost(true);
  }, []);

  const onBoostUp = useCallback(() => {
    engineRef.current?.pressBoost(false);
  }, []);

  const onSlideDown = useCallback(() => {
    engineRef.current?.pressSlide(true);
  }, []);

  const onSlideUp = useCallback(() => {
    engineRef.current?.pressSlide(false);
  }, []);

  const onFire = useCallback(() => {
    engineRef.current?.pressFire();
  }, []);

  const onRestart = useCallback(() => {
    engineRef.current?.restart();
  }, []);

  const onStart = useCallback(() => {
    engineRef.current?.beginRun();
  }, []);

  const onPractice = useCallback(() => {
    engineRef.current?.startTutorial();
  }, []);

  const onWatch = useCallback(() => {
    engineRef.current?.watchAll();
  }, []);

  const onPlayCourse = useCallback((day: number) => {
    engineRef.current?.playCourse(day);
  }, []);

  const onStopTour = useCallback(() => {
    engineRef.current?.stopTour();
  }, []);

  const onChangeSettings = useCallback((next: GameSettings) => {
    setSettings(next);
    engineRef.current?.setSettings(next);
  }, []);

  const onChallenge = useCallback(
    (mode: RunMode) => {
      const beat = mode === "beat" ? parseInt(beatInput, 10) || 0 : 0;
      engineRef.current?.startChallenge(mode, beat);
    },
    [beatInput],
  );

  useEffect(() => {
    if (hud.phase !== "dead") return;
    const pid = playerIdRef.current;
    if (!pid || hud.score <= 0) return;
    if (hud.mode === "free") return;
    if (hud.score === lastSubmittedRef.current) return;
    lastSubmittedRef.current = hud.score;
    submitContestScoreFn({ data: { playerId: pid, score: hud.score } })
      .then(setContest)
      .catch(() => {});
  }, [hud.phase, hud.score, hud.mode]);

  const onShare = useCallback(async () => {
    const jobs = `${jobCount(hud)}/3 jobs`;
    const text = contestShareText(hud.score || contest.yourScore, jobs, hud.score || contest.yourScore);
    try {
      if (navigator.share) {
        await navigator.share({ title: "Red Tie Strike", text });
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

  return (
    <div className="relative flex h-dvh w-full flex-col items-center justify-center overflow-hidden bg-bg">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-80"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 78% 28%, color-mix(in oklab, #c46a3a 12%, transparent), transparent 60%), radial-gradient(ellipse 70% 50% at 18% 82%, color-mix(in oklab, #12161c 55%, transparent), transparent)",
        }}
      />

      <div className="relative z-10 flex h-full w-full max-w-[1100px] flex-col px-3 py-3 sm:px-5 sm:py-4">
        <header className="mb-2 flex shrink-0 items-start justify-between gap-3 sm:mb-3">
          <div>
            <p className="text-[0.7rem] font-medium tracking-[0.18em] text-fg-subtle uppercase">
              Arcade war runner
            </p>
            <h1 className="text-xl font-semibold tracking-tight text-fg sm:text-2xl">Red Tie Strike</h1>
          </div>

          <div className="flex flex-wrap items-start justify-end gap-2 sm:gap-3">
            <HudChip
              label={hud.phase === "playing" && hud.mode !== "free" ? "Jobs" : "Week"}
              value={
                hud.phase === "playing" && hud.mode !== "free"
                  ? `${jobCount(hud)}/3`
                  : formatWeekLeft(getContestWeek().endsAt)
              }
              emphasize
            />
            <HudChip
              label="Midterms"
              value={clock ? formatMidtermCompact(clock) : "--"}
              emphasize={!!clock && !clock.expired}
              accent={!!clock && clock.days <= 7 && !clock.expired}
            />
            {mounted && hud.phase !== "ready" && (
              <>
                <HudChip label="Lives" value={String(hud.lives)} emphasize />
                <HudChip label="Coins" value={String(hud.coins)} />
                {hud.form !== "normal" && (
                  <HudChip label="Power" value={hud.form === "sidearm" ? "Sidearm" : "Armor"} accent />
                )}
                {hud.flare > 0.2 && (
                  <HudChip label="Flare" value={`${Math.ceil(hud.flare)}s`} accent />
                )}
                <HudChip label="Best" value={Math.max(hud.highScore, hud.score).toLocaleString()} />
                <HudChip label="Intercepts" value={String(hud.intercepts)} />
                {hud.combo >= 1 && <HudChip label="Combo" value={`×${hud.combo}`} accent />}
                <SpeedMeter value={hud.speedNorm} />
              </>
            )}
          </div>
        </header>

        <div className="relative min-h-0 flex-1">
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="relative aspect-[16/9] h-full max-h-full w-full max-w-full overflow-hidden rounded-xl border border-border bg-bg-elevated shadow-[0_24px_80px_rgba(0,0,0,0.45)] sm:rounded-2xl">
              <canvas
                ref={canvasRef}
                className="block h-full w-full touch-none select-none"
                style={{ touchAction: "none" }}
                aria-label="Red Tie Strike game canvas"
              />

              {hud.phase === "ready" && (
                <div className="absolute inset-0 flex flex-col items-center justify-center overflow-y-auto bg-[color-mix(in_oklab,var(--color-bg)_55%,transparent)] px-5 py-8 text-center backdrop-blur-[2px] sm:px-6">
                  <p className="mb-1 text-[0.7rem] font-medium tracking-[0.2em] text-fg-subtle uppercase">
                    Best {hud.highScore.toLocaleString()}
                  </p>
                  <h2 className="mb-3 text-3xl font-semibold tracking-tight text-fg sm:text-4xl">
                    Trump vs Tehran
                  </h2>

                  <div className="mb-4 w-full max-w-sm rounded-2xl border border-border bg-bg-elevated/90 px-4 py-3 text-left sm:px-5">
                    <p className="text-[0.65rem] font-medium tracking-[0.16em] text-fg-subtle uppercase">
                      Pick a challenge
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-fg-muted">
                      No prize money. Weekly strike uses one shared course, so scores compare. Ends{" "}
                      {formatWeekLeft(contest.endsAt)}.
                    </p>
                    {contest.leaderScore > 0 && (
                      <p className="mt-2 text-xs text-fg">
                        Week best {contest.leaderScore.toLocaleString()}
                        {contest.youLead ? " — yours" : ""}
                      </p>
                    )}
                  </div>

                  {settingsOpen ? (
                    <div className="flex w-full max-w-sm flex-col gap-3 rounded-2xl border border-border bg-bg-elevated/90 px-4 py-3 text-left">
                      <p className="text-[0.65rem] font-medium tracking-[0.16em] text-fg-subtle uppercase">Settings</p>
                      <SettingRow label="Lives">
                        {([1, 3, 5] as const).map((n) => (
                          <Choice
                            key={n}
                            on={settings.lives === n}
                            onClick={() => onChangeSettings({ ...settings, lives: n })}
                          >
                            {n}
                          </Choice>
                        ))}
                      </SettingRow>
                      <SettingRow label="Pace">
                        {(["slow", "normal", "fast"] as Pace[]).map((pace) => (
                          <Choice
                            key={pace}
                            on={settings.pace === pace}
                            onClick={() => onChangeSettings({ ...settings, pace })}
                          >
                            {pace}
                          </Choice>
                        ))}
                      </SettingRow>
                      <SettingRow label="Shake">
                        <Choice on={settings.shake} onClick={() => onChangeSettings({ ...settings, shake: true })}>
                          On
                        </Choice>
                        <Choice on={!settings.shake} onClick={() => onChangeSettings({ ...settings, shake: false })}>
                          Off
                        </Choice>
                      </SettingRow>
                      <p className="text-xs leading-relaxed text-fg-muted">
                        Lives and pace apply to Free run and Practice. Today's course stays at 3 lives and normal pace so scores match.
                      </p>
                      <button
                        type="button"
                        onClick={() => setSettingsOpen(false)}
                        className="min-h-11 rounded-full bg-accent text-sm font-semibold text-accent-fg"
                      >
                        Done
                      </button>
                    </div>
                  ) : (
                  <div className="flex w-full max-w-sm flex-col gap-2">
                    <button
                      type="button"
                      onClick={() => onChallenge("weekly")}
                      className="min-h-11 rounded-full bg-accent px-8 py-3 text-sm font-semibold text-accent-fg active:scale-[0.98]"
                    >
                      Today's course
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
                    {hud.tourDone && (
                      <p className="text-center text-xs text-fg-muted">Watched all 7 courses.</p>
                    )}
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
                      Free run
                    </button>
                    <button
                      type="button"
                      onClick={onPractice}
                      className="min-h-11 text-sm font-semibold text-fg-muted"
                    >
                      Practice the controls
                    </button>
                    <button
                      type="button"
                      onClick={() => setSettingsOpen(true)}
                      className="min-h-11 text-sm font-semibold text-fg-muted"
                    >
                      Settings
                    </button>
                  </div>
                  )}
                  <p className="mt-3 text-xs text-fg-subtle">Jobs: 3 tanker landings, 3 slides, 3 shots</p>
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
                    <h2 className="mt-1 text-2xl font-semibold text-fg">You know the controls</h2>
                    <p className="mt-2 text-sm text-fg-muted">
                      Hold run, then jump, to land on the next tanker. Misses cost a life once the real run starts.
                    </p>
                    <button
                      type="button"
                      onClick={onStart}
                      className="mt-4 min-h-11 w-full rounded-full bg-accent px-6 py-3 text-sm font-semibold text-accent-fg"
                    >
                      Deploy
                    </button>
                  </div>
                </div>
              )}

              {hud.phase === "dead" && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-[color-mix(in_oklab,var(--color-bg)_62%,transparent)] px-6 text-center backdrop-blur-[3px]">
                  <div className="w-full max-w-sm rounded-2xl border border-border bg-bg-elevated/95 p-6 shadow-[0_16px_48px_rgba(0,0,0,0.4)] sm:p-8">
                    <p className="mb-1 text-[0.7rem] font-medium tracking-[0.18em] text-fg-subtle uppercase">
                      Mission ended
                    </p>
                    <h2 className="mb-1 text-2xl font-semibold tracking-tight text-fg sm:text-3xl">
                      {hud.isNewRecord ? "New personal best" : "Out of lives"}
                    </h2>
                    <p className="mb-4 text-xs text-fg-muted">
                      {hud.mode === "beat"
                        ? hud.beatMet
                          ? `Beat ${hud.beatTarget.toLocaleString()}`
                          : `Short of ${hud.beatTarget.toLocaleString()}`
                        : hud.mode === "weekly"
                          ? `Jobs ${jobCount(hud)}/3`
                          : "Free run"}
                      {contest.leaderScore > 0 ? ` · week best ${contest.leaderScore.toLocaleString()}` : ""}
                    </p>

                    <div className="mb-6 grid grid-cols-2 gap-3">
                      <StatCard label="Score" value={hud.score.toLocaleString()} />
                      <StatCard label="To beat" value={hud.mode === "beat" ? hud.beatTarget.toLocaleString() : contest.leaderScore.toLocaleString()} />
                      <StatCard label="Jobs" value={`${jobCount(hud)}/3`} />
                      <StatCard
                        label="Midterms"
                        value={clock ? formatMidtermCompact(clock) : "--"}
                      />
                    </div>

                    <div className="flex flex-col gap-2">
                      <button
                        type="button"
                        onClick={onShare}
                        className="flex min-h-11 w-full items-center justify-center gap-2 rounded-full border border-border bg-bg-subtle px-6 py-3 text-sm font-semibold text-fg transition-transform duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] active:scale-[0.98]"
                      >
                        {shareState === "copied" ? (
                          <Check className="size-4" aria-hidden />
                        ) : (
                          <Share2 className="size-4" aria-hidden />
                        )}
                        {shareState === "copied" ? "Challenge copied" : "Share this score"}
                      </button>
                      <button
                        type="button"
                        onClick={onRestart}
                        className="flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-accent px-6 py-3 text-sm font-semibold text-accent-fg transition-transform duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] hover:brightness-105 active:scale-[0.98]"
                      >
                        <RotateCcw className="size-4" aria-hidden />
                        Start over
                      </button>
                    </div>
                    <p className="mt-3 text-xs text-fg-subtle">Space or Enter to restart</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="mt-3 grid shrink-0 grid-cols-[1fr_1.2fr] gap-2 md:hidden">
          <div className="grid grid-rows-2 gap-2">
            <button
              type="button"
              {...holdButton(onBoostDown, onBoostUp)}
              className={`min-h-16 rounded-2xl border text-sm font-semibold ${
                hud.boosting ? "border-accent bg-accent text-accent-fg" : "border-border bg-bg-elevated text-fg"
              }`}
            >
              Run
            </button>
            <button
              type="button"
              {...holdButton(onSlideDown, onSlideUp)}
              className={`flex min-h-16 items-center justify-center gap-1 rounded-2xl border text-sm font-semibold ${
                hud.sliding ? "border-accent bg-accent text-accent-fg" : "border-border bg-bg-elevated text-fg"
              }`}
            >
              <ChevronDown className="size-4" aria-hidden />
              Slide
            </button>
          </div>
          <div className="grid grid-rows-[1.4fr_0.8fr] gap-2">
            <button
              type="button"
              {...holdButton(onJump, onJumpUp)}
              className={`flex min-h-20 items-center justify-center gap-2 rounded-2xl border text-base font-semibold ${
                hud.jumpHeld ? "border-accent bg-accent text-accent-fg" : "border-border bg-bg-elevated text-fg"
              }`}
            >
              <ChevronUp className="size-5" aria-hidden />
              Jump
            </button>
            <button
              type="button"
              onPointerDown={(e) => {
                e.preventDefault();
                onFire();
              }}
              className={`flex min-h-12 items-center justify-center gap-2 rounded-2xl border text-sm font-semibold ${
                hud.fireReady ? "border-border bg-bg-elevated text-fg" : "border-border bg-bg-subtle text-fg-muted"
              }`}
            >
              <Crosshair className="size-4" aria-hidden />
              Fire
            </button>
          </div>
        </div>

        <div className="mt-3 hidden shrink-0 items-center justify-center gap-2 md:flex">
          <KeyHint label="Space" note="hold jump" />
          <KeyHint label="Shift" note="hold run" />
          <KeyHint label="Down" note="slide" />
          <KeyHint label="F" note="fire" />
        </div>
      </div>
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

function Choice({
  on,
  onClick,
  children,
}: {
  on: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-9 rounded-full px-3 text-xs font-semibold capitalize ${
        on ? "bg-accent text-accent-fg" : "border border-border text-fg-muted"
      }`}
    >
      {children}
    </button>
  );
}

function jobCount(hud: HudSnapshot) {
  return (hud.hops >= 3 ? 1 : 0) + (hud.slides >= 3 ? 1 : 0) + (hud.intercepts >= 3 ? 1 : 0);
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

function KeyHint({ label, note }: { label: string; note: string }) {
  return (
    <div className="flex items-center gap-2 rounded-full border border-border bg-bg-elevated px-3 py-1.5">
      <span className="font-mono text-xs font-semibold text-fg">{label}</span>
      <span className="text-xs text-fg-muted">{note}</span>
    </div>
  );
}

function useMidtermClock(): MidtermRemaining | null {
  const [remaining, setRemaining] = useState<MidtermRemaining | null>(null);

  useEffect(() => {
    const tick = () => setRemaining(getMidtermRemaining());
    tick();
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, []);

  return remaining;
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
      <p className="text-[0.65rem] font-medium tracking-wide text-fg-subtle uppercase">Threat</p>
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
