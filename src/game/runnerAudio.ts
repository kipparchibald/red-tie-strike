type SfxKind = "coin" | "combo" | "power" | "jump" | "hit" | "record";

let muted = false;
let ctx: AudioContext | null = null;

function ac(): AudioContext | null {
  if (muted) return null;
  if (typeof window === "undefined") return null;
  if (!ctx) {
    try {
      ctx = new AudioContext();
    } catch {
      return null;
    }
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

export function setRunnerMuted(next: boolean) {
  muted = next;
}

export function isRunnerMuted() {
  return muted;
}

function tone(freq: number, dur: number, type: OscillatorType, gain = 0.08) {
  const c = ac();
  if (!c) return;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.value = gain;
  o.connect(g);
  g.connect(c.destination);
  const t = c.currentTime;
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.start(t);
  o.stop(t + dur);
}

export function playSfx(kind: SfxKind) {
  switch (kind) {
    case "coin":
      tone(880, 0.08, "sine", 0.06);
      tone(1320, 0.06, "sine", 0.04);
      break;
    case "combo":
      tone(660, 0.1, "triangle", 0.07);
      tone(990, 0.12, "triangle", 0.05);
      break;
    case "power":
      tone(440, 0.14, "square", 0.05);
      tone(880, 0.18, "sine", 0.06);
      break;
    case "jump":
      tone(520, 0.07, "sine", 0.05);
      break;
    case "hit":
      tone(180, 0.2, "sawtooth", 0.08);
      break;
    case "record":
      tone(523, 0.12, "sine", 0.07);
      tone(659, 0.12, "sine", 0.06);
      tone(784, 0.2, "sine", 0.08);
      break;
  }
}
