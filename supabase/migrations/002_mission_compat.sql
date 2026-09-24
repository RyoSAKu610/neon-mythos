-- 002_mission_compat: Mission is ONE Request kind, not the parent of all activity.
-- Collective-intelligence loop (Ask→…→Learn) runs as Tasks under a Contract.
create table if not exists missions (
  id uuid primary key default gen_random_uuid(),
  request_id uuid unique references requests(id) on delete set null,
  title text not null,
  question text not null default '',
  status text not null default 'open',
  world_id text not null default 'production' references worlds(id),
  created_by uuid references principals(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists mission_stages (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null references missions(id) on delete cascade,
  task_id uuid references tasks(id) on delete set null,
  stage text not null, -- research|debate|falsify|synthesize|decide|plan|execute|learn
  summary text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists decisions (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid references missions(id) on delete set null,
  contract_id uuid references contracts(id) on delete set null,
  summary text not null,
  options jsonb not null default '[]',
  approved boolean,
  world_id text not null default 'production' references worlds(id),
  created_at timestamptz not null default now()
);

-- Seed default worlds + capabilities (idempotent).
insert into worlds(id, kind) values ('production','production') on conflict (id) do nothing;
insert into worlds(id, kind) values ('sim:fast-001','simulation') on conflict (id) do nothing;

insert into capabilities(id, name) values
  ('research.summarize','Research summarization'),
  ('code.review','Code review'),
  ('strategy.analyze','Strategy analysis'),
  ('verify.judge','Verification judging')
on conflict (id) do nothing;
