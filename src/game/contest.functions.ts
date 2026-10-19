import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { sanitizeNickname } from "./profanity";

const playerIdSchema = z.object({
  playerId: z.string().min(8).max(80),
  nickname: z.string().max(16).optional(),
});

const submitSchema = z.object({
  playerId: z.string().min(8).max(80),
  score: z.number().int().min(0).max(10_000_000),
  nickname: z.string().max(16).optional(),
});

export const getContestFn = createServerFn({ method: "POST" })
  .validator(playerIdSchema)
  .handler(async ({ data }) => {
    const { joinAndRead } = await import("./contest.server");
    const nick = data.nickname ? sanitizeNickname(data.nickname) : undefined;
    return joinAndRead(data.playerId, nick);
  });

export const submitContestScoreFn = createServerFn({ method: "POST" })
  .validator(submitSchema)
  .handler(async ({ data }) => {
    const { submitAndRead } = await import("./contest.server");
    const nick = data.nickname ? sanitizeNickname(data.nickname) : undefined;
    return submitAndRead(data.playerId, data.score, nick);
  });
