alter table contest_players
  add column if not exists nickname text not null default 'Rider';

create index if not exists contest_scores_week_score_created_idx
  on contest_scores (week_id, score desc, created_at desc);
