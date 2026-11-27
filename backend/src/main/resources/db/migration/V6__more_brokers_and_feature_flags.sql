-- Two more white-label brokers that differ in features and limits, not only in looks,
-- plus a platform admin account. Deterministic seed data, as everywhere else.

-- ---- more feature flags and per-broker limits --------------------------------------------------
alter table tenant add column feature_screener   boolean not null default true;
alter table tenant add column feature_news       boolean not null default true;
alter table tenant add column feature_calendar   boolean not null default true;
alter table tenant add column feature_compare    boolean not null default true;
alter table tenant add column feature_alerts     boolean not null default true;
alter table tenant add column feature_risk_view  boolean not null default true;
alter table tenant add column max_order_value    numeric(20, 2);   -- per order, in the broker currency; null = no limit
alter table tenant add column max_open_orders    integer;          -- pending (limit/stop) orders per client; null = no limit

-- the original four get distinct profiles too
update tenant set max_open_orders = 20 where id = 'kestrel';
update tenant set feature_compare = false, max_order_value = 200000 where id = 'wisla';
update tenant set feature_screener = false, feature_alerts = false where id = 'sakura';

-- ---- new brokers ---------------------------------------------------------------------------------
insert into tenant (id, name, tagline, locale, currency, allowed_asset_classes, spread_markup_bps, logo_shape,
                    theme_primary, theme_on_primary, theme_accent, theme_background, theme_surface, theme_text,
                    theme_muted, theme_positive, theme_negative, theme_radius, theme_color_scheme, font_body, font_heading,
                    feature_trading, feature_limit_orders, feature_simulator_panel, feature_live_prices,
                    feature_screener, feature_news, feature_calendar, feature_compare, feature_alerts, feature_risk_view,
                    max_order_value, max_open_orders) values
('alpenrose', 'Alpenrose Private Bank', 'Discreet wealth, managed since 1891', 'de-CH', 'CHF',
 '{STOCK,ETF,BOND,INDEX}', 8, 'alpenrose',
 '#14532d', '#ffffff', '#b45309', '#f7f5ef', '#fffdf8', '#1c1917', '#6b6358', '#15803d', '#b91c1c', '6px', 'light',
 '"Segoe UI", system-ui, sans-serif', 'Georgia, "Palatino Linotype", serif',
 true, true, false, true,
 true, true, true, true, true, true,
 50000, 5),

('pulse', 'Pulse', 'Your first trade in 60 seconds', 'en-US', 'USD',
 '{CRYPTO,STOCK,ETF}', 35, 'pulse',
 '#a3e635', '#0a0a12', '#f472b6', '#0a0a12', '#151521', '#f4f4f8', '#9a9ab0', '#4ade80', '#fb7185', '16px', 'dark',
 '"Segoe UI", system-ui, sans-serif', '"Segoe UI Black", "Segoe UI", system-ui, sans-serif',
 true, false, false, true,
 false, true, false, false, true, false,
 2000, 0);

-- ---- users, accounts and positions for the new brokers -------------------------------------------
insert into app_user (id, tenant_id, email, display_name, password_hash, roles)
select u.id::uuid, u.tenant_id, u.email, u.display_name,
       '{bcrypt}$2a$10$wJ.qkqk2E85KDM4ujWPk.urEbXnM8UfNjfT5l3YCMXHsxiUsoyfHS', u.roles::text[]
from (values
    ('00000005-0000-4000-8000-000000000001', 'alpenrose', 'trader@alpenrose.test', 'Anna Trader',   '{TRADER}'),
    ('00000005-0000-4000-8000-000000000002', 'alpenrose', 'viewer@alpenrose.test', 'Vinzenz Viewer', '{VIEWER}'),
    ('00000006-0000-4000-8000-000000000001', 'pulse',     'trader@pulse.test',     'Parker Trader', '{TRADER}'),
    ('00000006-0000-4000-8000-000000000002', 'pulse',     'viewer@pulse.test',     'Val Viewer',    '{VIEWER}'),
    -- platform operator: lives on the default broker, sees all brokers in the admin panel
    ('00000001-0000-4000-8000-0000000000ad', 'aurora',    'admin@aurora.test',     'Platform Admin', '{ADMIN}')
) as u (id, tenant_id, email, display_name, roles);

insert into account (id, tenant_id, user_id, currency, cash, created_at)
select ('a' || substr(u.id::text, 2))::uuid, u.tenant_id, u.id::text, t.currency,
       case t.id when 'alpenrose' then 250000 when 'pulse' then 10000 else 100000 end,
       timestamptz '2026-01-02 09:00:00+00'
from app_user u join tenant t on t.id = u.tenant_id
where u.tenant_id in ('alpenrose', 'pulse') or u.email = 'admin@aurora.test';

insert into cash_transaction (id, account_id, type, amount, balance_after, reference, description, created_at)
select ('c' || substr(a.id::text, 2))::uuid, a.id, 'DEPOSIT', a.cash, a.cash, null, 'Opening deposit', a.created_at
from account a
where a.tenant_id in ('alpenrose', 'pulse') or a.user_id = '00000001-0000-4000-8000-0000000000ad';

insert into position (account_id, symbol, quantity, avg_price)
select a.id, p.symbol, p.quantity, p.avg_price
from account a
join (values
    ('alpenrose', 'SAP',    80,   205.00),
    ('alpenrose', 'VWCE',   400,  115.00),
    ('alpenrose', 'DE10Y',  300,  100.50),
    ('pulse',     'BTCUSD', 0.02, 90000.00),
    ('pulse',     'NVDA',   10,   130.00)
) as p (tenant_id, symbol, quantity, avg_price) on p.tenant_id = a.tenant_id;

insert into watchlist_item (tenant_id, user_id, symbol, added_at)
select u.tenant_id, u.id::text, w.symbol, timestamptz '2026-01-02 09:00:00+00'
from app_user u
join (values ('alpenrose', 'SAP'), ('alpenrose', 'DAX40'), ('alpenrose', 'DE10Y'),
             ('pulse', 'BTCUSD'), ('pulse', 'ETHUSD'), ('pulse', 'SOLUSD'), ('pulse', 'NVDA')
) as w (tenant_id, symbol) on w.tenant_id = u.tenant_id;
