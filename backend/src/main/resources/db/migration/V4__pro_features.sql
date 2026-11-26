-- "Pro" trading features: stop orders, SL/TP, watchlists, price alerts, cash ledger, closed trades.

-- ---- orders: STOP and STOP_LIMIT, bracket (SL/TP), automatic orders -------------------------
alter table trade_order drop constraint trade_order_type_check;
alter table trade_order add constraint trade_order_type_check
    check (type in ('MARKET', 'LIMIT', 'STOP', 'STOP_LIMIT'));
alter table trade_order add column stop_price  numeric(20, 8);
alter table trade_order add column stop_loss   numeric(20, 8);   -- attached to the position when a BUY fills
alter table trade_order add column take_profit numeric(20, 8);
alter table trade_order add column triggered   boolean     not null default false; -- STOP_LIMIT turned into a resting LIMIT
alter table trade_order add column origin      varchar(12) not null default 'CLIENT'
    check (origin in ('CLIENT', 'STOP_LOSS', 'TAKE_PROFIT'));

-- ---- protection on open positions ------------------------------------------------------------
alter table position add column stop_loss   numeric(20, 8);
alter table position add column take_profit numeric(20, 8);
create index position_protected_idx on position (symbol) where stop_loss is not null or take_profit is not null;

-- ---- watchlists --------------------------------------------------------------------------------
create table watchlist_item (
    tenant_id varchar(32) not null references tenant (id),
    user_id   varchar(64) not null,
    symbol    varchar(16) not null references instrument (symbol),
    added_at  timestamptz not null default now(),
    primary key (tenant_id, user_id, symbol)
);

-- ---- price alerts -------------------------------------------------------------------------------
create table price_alert (
    id              uuid primary key,
    tenant_id       varchar(32)    not null references tenant (id),
    user_id         varchar(64)    not null,
    symbol          varchar(16)    not null references instrument (symbol),
    condition       varchar(8)     not null check (condition in ('ABOVE', 'BELOW')),
    price           numeric(20, 8) not null check (price > 0),
    note            varchar(120),
    status          varchar(10)    not null check (status in ('ACTIVE', 'TRIGGERED', 'CANCELLED')),
    acknowledged    boolean        not null default false,
    created_at      timestamptz    not null,
    triggered_at    timestamptz,
    triggered_price numeric(20, 8)
);
create index price_alert_active_idx on price_alert (symbol) where status = 'ACTIVE';
create index price_alert_user_idx on price_alert (tenant_id, user_id, created_at desc);

-- ---- cash ledger (account statement) ------------------------------------------------------------
create table cash_transaction (
    id            uuid primary key,
    account_id    uuid           not null references account (id),
    type          varchar(10)    not null check (type in ('DEPOSIT', 'WITHDRAWAL', 'BUY', 'SELL')),
    amount        numeric(20, 4) not null,              -- signed, in the account currency
    balance_after numeric(20, 4) not null,
    reference     uuid,                                 -- order id for BUY/SELL
    description   varchar(160)   not null,
    created_at    timestamptz    not null
);
create index cash_transaction_account_idx on cash_transaction (account_id, created_at desc);

-- ---- realised P&L ---------------------------------------------------------------------------------
create table closed_trade (
    id           uuid primary key,
    account_id   uuid           not null references account (id),
    order_id     uuid           not null,
    symbol       varchar(16)    not null references instrument (symbol),
    quantity     numeric(20, 8) not null,
    open_price   numeric(20, 8) not null,               -- average cost, instrument currency
    close_price  numeric(20, 8) not null,               -- instrument currency
    currency     char(3)        not null,               -- instrument currency
    realized_pnl numeric(20, 4) not null,               -- account currency
    closed_at    timestamptz    not null
);
create index closed_trade_account_idx on closed_trade (account_id, closed_at desc);

-- ---- deterministic seed: opening deposit for every account, a starter watchlist for traders -------
insert into cash_transaction (id, account_id, type, amount, balance_after, reference, description, created_at)
select ('c' || substr(a.id::text, 2))::uuid, a.id, 'DEPOSIT', a.cash, a.cash, null, 'Opening deposit', a.created_at
from account a;

insert into watchlist_item (tenant_id, user_id, symbol, added_at)
select u.tenant_id, u.id::text, w.symbol, timestamptz '2026-01-02 09:00:00+00'
from app_user u
join (values
    ('aurora', 'AAPL'), ('aurora', 'NVDA'), ('aurora', 'BTCUSD'), ('aurora', 'EURUSD'),
    ('kestrel', 'SAP'), ('kestrel', 'ASML'), ('kestrel', 'ETHUSD'),
    ('wisla', 'PKO'), ('wisla', 'CDR'), ('wisla', 'USDPLN'),
    ('sakura', '7203'), ('sakura', 'VWCE')
) as w (tenant_id, symbol) on w.tenant_id = u.tenant_id;
