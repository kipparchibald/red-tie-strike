import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const playerIdSchema = z.object({
  playerId: z.string().min(8).max(80),
});

const submitSchema = z.object({
  playerId: z.string().min(8).max(80),
  score: z.number().int().min(0).max(10_000_000),
});

export const getContestFn = createServerFn({ method: "POST" })
  .validator(playerIdSchema)
  .handler(async ({ data }) => {
    const { joinAndRead } = await import("./contest.server");
    return joinAndRead(data.playerId);
  });

export const submitContestScoreFn = createServerFn({ method: "POST" })
  .validator(submitSchema)
  .handler(async ({ data }) => {
    const { submitAndRead } = await import("./contest.server");
    return submitAndRead(data.playerId, data.score);
  });
