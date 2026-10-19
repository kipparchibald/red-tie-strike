import { getSql } from "@/lib/db";
import { getContestWeek, type ContestSnapshot, type LeaderboardEntry } from "./contest";
import { sanitizeNickname } from "./profanity";

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

  const topRows = await sql<{ nickname: string; score: number }>`
    select coalesce(p.nickname, 'Rider') as nickname, max(s.score)::int as score
    from contest_scores s
    join contest_players p on p.id = s.player_id
    where s.week_id = ${week.weekId}
    group by p.id, p.nickname
    order by score desc
    limit 5
  `;

  const top: LeaderboardEntry[] = topRows.map((row) => ({
    nickname: sanitizeNickname(row.nickname ?? "Rider"),
    score: asInt(row.score),
  }));

  const uniqueThisWeek = asInt(weekCount?.n);
  const lifetimePlayers = asInt(lifeCount?.n);
  const leaderScore = asInt(lead?.score);
  const yourScore = asInt(mine?.score);

  return {
    weekId: week.weekId,
    endsAt: week.endsAt,
    startsAt: week.startsAt,
    uniqueThisWeek,
    lifetimePlayers,
    leaderScore,
    yourScore,
    youLead: yourScore > 0 && yourScore >= leaderScore,
    top,
  };
}

export async function joinAndRead(playerId: string, nickname?: string): Promise<ContestSnapshot> {
  const sql = await getSql();
  const week = getContestWeek();
  const id = playerId.slice(0, 80);
  const nick = sanitizeNickname(nickname ?? "Rider");

  await sql`
    insert into contest_players (id, nickname) values (${id}, ${nick})
    on conflict (id) do update set nickname = excluded.nickname
  `;
  await sql`
    insert into contest_week_players (week_id, player_id)
    values (${week.weekId}, ${id})
    on conflict (week_id, player_id) do nothing
  `;

  return readContest(id);
}

export async function submitAndRead(
  playerId: string,
  score: number,
  nickname?: string,
): Promise<ContestSnapshot> {
  const sql = await getSql();
  const week = getContestWeek();
  const id = playerId.slice(0, 80);
  const safe = Math.max(0, Math.min(10_000_000, Math.floor(score)));
  const nick = sanitizeNickname(nickname ?? "Rider");

  await sql`
    insert into contest_players (id, nickname) values (${id}, ${nick})
    on conflict (id) do update set nickname = excluded.nickname
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
