-- Demo users for every tenant. Password for all of them: demo  (BCrypt hash below)
--   trader@<tenant>.test  -> role TRADER (can place orders)
--   viewer@<tenant>.test  -> role VIEWER (read only)

insert into app_user (id, tenant_id, email, display_name, password_hash, roles)
select u.id::uuid, u.tenant_id, u.email, u.display_name, '{bcrypt}$2a$10$wJ.qkqk2E85KDM4ujWPk.urEbXnM8UfNjfT5l3YCMXHsxiUsoyfHS', u.roles::text[]
from (values
    ('00000001-0000-4000-8000-000000000001', 'aurora',  'trader@aurora.test',  'Ada Trader',      '{TRADER}'),
    ('00000001-0000-4000-8000-000000000002', 'aurora',  'viewer@aurora.test',  'Victor Viewer',   '{VIEWER}'),
    ('00000002-0000-4000-8000-000000000001', 'kestrel', 'trader@kestrel.test', 'Klaus Trader',    '{TRADER}'),
    ('00000002-0000-4000-8000-000000000002', 'kestrel', 'viewer@kestrel.test', 'Vera Viewer',     '{VIEWER}'),
    ('00000003-0000-4000-8000-000000000001', 'wisla',   'trader@wisla.test',   'Tomasz Trader',   '{TRADER}'),
    ('00000003-0000-4000-8000-000000000002', 'wisla',   'viewer@wisla.test',   'Wanda Viewer',    '{VIEWER}'),
    ('00000004-0000-4000-8000-000000000001', 'sakura',  'trader@sakura.test',  'Takumi Trader',   '{TRADER}'),
    ('00000004-0000-4000-8000-000000000002', 'sakura',  'viewer@sakura.test',  'Yui Viewer',      '{VIEWER}')
) as u (id, tenant_id, email, display_name, roles);

-- One account per user, in the tenant currency. Account ids mirror user ids (prefix a).
insert into account (id, tenant_id, user_id, currency, cash, created_at)
select ('a' || substr(u.id::text, 2))::uuid, u.tenant_id, u.id::text, t.currency,
       case t.currency when 'GBP' then 100000 when 'EUR' then 100000 when 'PLN' then 400000 else 15000000 end,
       timestamptz '2026-01-02 09:00:00+00'
from app_user u join tenant t on t.id = u.tenant_id;

-- Starting positions (same for trader and viewer of a tenant so the viewer has something to look at).
insert into position (account_id, symbol, quantity, avg_price)
select a.id, p.symbol, p.quantity, p.avg_price
from account a
join (values
    ('aurora',  'AAPL',   25,    210.00),
    ('aurora',  'BTCUSD', 0.5,   82000.00),
    ('aurora',  'SPY',    10,    560.00),
    ('kestrel', 'SAP',    40,    220.00),
    ('kestrel', 'ETHUSD', 3,     3000.00),
    ('kestrel', 'NVDA',   50,    128.00),
    ('wisla',   'PKO',    500,   52.00),
    ('wisla',   'CDR',    100,   190.00),
    ('wisla',   'PL10Y',  50,    97.00),
    ('sakura',  '7203',   300,   2700),
    ('sakura',  'VWCE',   100,   120.00),
    ('sakura',  'JGB10Y', 100,   99.50)
) as p (tenant_id, symbol, quantity, avg_price) on p.tenant_id = a.tenant_id;
