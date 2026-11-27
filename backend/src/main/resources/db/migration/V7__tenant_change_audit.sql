-- Audit log of broker settings changed in the admin panel (written by the admin module from TenantUpdated events).
create table tenant_change (
    id         bigint generated always as identity primary key,
    tenant_id  varchar(32) not null references tenant (id),
    changed_by varchar(160) not null,
    changed_at timestamptz  not null,
    changes    text[]       not null
);

create index tenant_change_by_tenant on tenant_change (tenant_id, changed_at desc);
