-- Two administrative levels instead of one admin living on a broker:
--   * MAINTAINER: a semi-admin of ONE broker (app_user, tenant-scoped token), edits only that broker.
--   * platform ADMIN: manages all brokers from a separate console; not a user of any broker,
--     so it lives in its own table and signs in at its own endpoint.

create table platform_user (
    id            uuid primary key,
    email         varchar(160) not null unique,
    display_name  varchar(80)  not null,
    password_hash varchar(100) not null,
    roles         text[]       not null
);

insert into platform_user (id, email, display_name, password_hash, roles) values
    ('00000000-0000-4000-8000-0000000000ad', 'admin@tradechameleon.com', 'Platform Admin',
     '{bcrypt}$2a$10$wJ.qkqk2E85KDM4ujWPk.urEbXnM8UfNjfT5l3YCMXHsxiUsoyfHS', '{ADMIN}');

-- the old broker-bound admin goes away, with everything that belonged to it
delete from watchlist_item where user_id = '00000001-0000-4000-8000-0000000000ad';
delete from price_alert    where user_id = '00000001-0000-4000-8000-0000000000ad';
delete from trade_order    where user_id = '00000001-0000-4000-8000-0000000000ad';
delete from closed_trade     where account_id in (select id from account where user_id = '00000001-0000-4000-8000-0000000000ad');
delete from cash_transaction where account_id in (select id from account where user_id = '00000001-0000-4000-8000-0000000000ad');
delete from position         where account_id in (select id from account where user_id = '00000001-0000-4000-8000-0000000000ad');
delete from account  where user_id = '00000001-0000-4000-8000-0000000000ad';
delete from app_user where id = '00000001-0000-4000-8000-0000000000ad';

-- one maintainer per broker; VIEWER as well, so they can look at their site read-only
insert into app_user (id, tenant_id, email, display_name, password_hash, roles)
select u.id::uuid, u.tenant_id, u.email, u.display_name,
       '{bcrypt}$2a$10$wJ.qkqk2E85KDM4ujWPk.urEbXnM8UfNjfT5l3YCMXHsxiUsoyfHS', '{MAINTAINER,VIEWER}'
from (values
    ('00000001-0000-4000-8000-000000000003', 'aurora',    'maintainer@aurora.test',    'Mia Maintainer'),
    ('00000002-0000-4000-8000-000000000003', 'kestrel',   'maintainer@kestrel.test',   'Max Maintainer'),
    ('00000003-0000-4000-8000-000000000003', 'wisla',     'maintainer@wisla.test',     'Marta Maintainer'),
    ('00000004-0000-4000-8000-000000000003', 'sakura',    'maintainer@sakura.test',    'Mei Maintainer'),
    ('00000005-0000-4000-8000-000000000003', 'alpenrose', 'maintainer@alpenrose.test', 'Moritz Maintainer'),
    ('00000006-0000-4000-8000-000000000003', 'pulse',     'maintainer@pulse.test',     'Morgan Maintainer')
) as u (id, tenant_id, email, display_name);
