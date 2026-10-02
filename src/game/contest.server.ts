import { getSql } from "@/lib/db";
import { getContestWeek, type ContestSnapshot } from "./contest";

function asInt(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return Math.floor(v);
  if (typeof v === "bigint") return Number(v);
  if (typeof v === "string") return parseInt(v, 10) || 0;
  return 0;
}

export async function readContest(playerId: string): Promise<ContestSnapshot> {
  const sql = await getSql();
  const week = getContestWeek();

  const [weekCount] = await sql<{ n: number }>`
    select count(*)::int as n from contest_week_players where week_id = ${week.weekId}
  `;
  const [lifeCount] = await sql<{ n: number }>`
    select count(*)::int as n from contest_players
  `;
  const [lead] = await sql<{ score: number }>`
    select coalesce(max(score), 0)::int as score
    from contest_scores
    where week_id = ${week.weekId}
  `;
  const [mine] = await sql<{ score: number }>`
    select coalesce(max(score), 0)::int as score
    from contest_scores
    where week_id = ${week.weekId} and player_id = ${playerId}
  `;

  const uniqueThisWeek = asInt(weekCount?.n);
  const lifetimePlayers = asInt(lifeCount?.n);
  const leaderScore = asInt(lead?.score);
  const yourScore = asInt(mine?.score);

  return {
    weekId: week.weekId,
    endsAt: week.endsAt,
    startsAt: week.startsAt,
    potDollars: 0,
    uniqueThisWeek,
    lifetimePlayers,
    leaderScore,
    yourScore,
    youLead: yourScore > 0 && yourScore >= leaderScore,
  };
}

export async function joinAndRead(playerId: string): Promise<ContestSnapshot> {
  const sql = await getSql();
  const week = getContestWeek();
  const id = playerId.slice(0, 80);

  await sql`
    insert into contest_players (id) values (${id})
    on conflict (id) do nothing
  `;
  await sql`
    insert into contest_week_players (week_id, player_id)
    values (${week.weekId}, ${id})
    on conflict (week_id, player_id) do nothing
  `;

  return readContest(id);
}

export async function submitAndRead(playerId: string, score: number): Promise<ContestSnapshot> {
  const sql = await getSql();
  const week = getContestWeek();
  const id = playerId.slice(0, 80);
  const safe = Math.max(0, Math.min(10_000_000, Math.floor(score)));

  await sql`
    insert into contest_players (id) values (${id})
    on conflict (id) do nothing
  `;
  await sql`
    insert into contest_week_players (week_id, player_id)
    values (${week.weekId}, ${id})
    on conflict (week_id, player_id) do nothing
  `;
  await sql`
    insert into contest_scores (week_id, player_id, score)
    values (${week.weekId}, ${id}, ${safe})
  `;

  return readContest(id);
}
