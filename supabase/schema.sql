-- Optional: move storage from .data/store.json to Supabase (Postgres).
-- Run in the Supabase SQL editor, then rewrite loadStore/saveStore in
-- src/lib/store.ts to read/write these tables. Nothing else needs to change.

create extension if not exists vector;

create table test_steps (
  id text primary key,            -- 'S4'
  number int not null,
  name text not null,
  instruction text not null,
  expected text not null
);

create table known_issues (
  id text primary key,
  step_id text references test_steps(id),
  title text not null,
  description text not null
);

create table reports (
  id text primary key,
  tester text not null,
  step_id text references test_steps(id),
  comment text not null,
  browser text,
  created_at timestamptz default now(),
  tester_confirmed_group_id text,
  embedding vector(1536)          -- match your embedding model's size
);

create table report_messages (     -- kind questions and tester replies
  id bigserial primary key,
  report_id text references reports(id) on delete cascade,
  sender text check (sender in ('manager','tester')),
  body text not null,
  sent_at timestamptz default now()
);

create table groups (
  id text primary key,
  step_id text references test_steps(id),
  ai_category text not null,
  category text not null,
  category_overridden boolean default false,
  status text not null default 'pending',
  ticket_id text,
  locked boolean default false,
  draft jsonb,                     -- TicketDraft
  question text,
  outcome_note text,
  derived jsonb                    -- confidence, reasons, shared terms, related groups
);

create table group_reports (
  group_id text references groups(id) on delete cascade,
  report_id text references reports(id) on delete cascade,
  primary key (group_id, report_id)
);

create table cannot_link (          -- "a person said these are NOT the same"
  a text references reports(id),
  b text references reports(id),
  primary key (a, b)
);

create table decision_log (
  id bigserial primary key,
  at timestamptz default now(),
  actor text not null,             -- 'UAT manager' | 'Tester' | 'System'
  action text not null,
  detail text not null,
  group_id text,
  reason text,
  tool_suggested text
);
