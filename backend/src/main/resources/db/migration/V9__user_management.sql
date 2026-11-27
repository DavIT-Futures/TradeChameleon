-- User management by maintainers and the platform admin: accounts can be disabled, and we keep when they were created.
alter table app_user add column enabled boolean not null default true;
alter table app_user add column created_at timestamptz not null default timestamptz '2026-01-02 09:00:00+00';
alter table app_user alter column created_at set default now();
