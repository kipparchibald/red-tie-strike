-- Weekly high-score prize pool. Public contest (player_id is a client-generated
-- id, not an auth user). Pot starts at $100 and grows with unique players.

create table if not exists contest_players (
  id         text primary key,
  created_at timestamptz not null default now()
);

create table if not exists contest_week_players (
  week_id    text not null,
  player_id  text not null references contest_players (id) on delete cascade,
  joined_at  timestamptz not null default now(),
  primary key (week_id, player_id)
);

create table if not exists contest_scores (
  id         serial primary key,
  week_id    text not null,
  player_id  text not null,
  score      integer not null,
  created_at timestamptz not null default now()
);

create index if not exists contest_scores_week_score_idx
  on contest_scores (week_id, score desc);

create index if not exists contest_week_players_player_idx
  on contest_week_players (player_id);
