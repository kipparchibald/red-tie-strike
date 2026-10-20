import { useEffect, useRef } from "react";
import { drawLobbyShowcase } from "@/game/runnerToon";
import type { BoardId, SkinId } from "@/game/runnerMeta";

type Props = {
  skin: SkinId;
  board: BoardId;
  className?: string;
};

/** Lobby preview of the rider for the skins shop. */
export function CharacterShowcase({ skin, board, className }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const phaseRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let last = 0;
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const frame = (ts: number) => {
      const dt = last ? Math.min(0.032, (ts - last) / 1000) : 0.016;
      last = ts;
      phaseRef.current += dt;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      ctx.clearRect(0, 0, w, h);
      drawLobbyShowcase(ctx, w, h, skin, board, phaseRef.current);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [skin, board]);

  return (
    <canvas
      ref={canvasRef}
      className={className ?? "h-44 w-full rounded-2xl border-2 border-[#1a1028] shadow-[0_8px_0_#1a1028]"}
      aria-label="Character preview"
    />
  );
}
