-- TradeChameleon schema. Every business table carries tenant_id: one database, many white-label brokers.

create table tenant (
    id                      varchar(32) primary key,
    name                    varchar(80)  not null,
    tagline                 varchar(160) not null,
    locale                  varchar(16)  not null,
    currency                char(3)      not null,
    allowed_asset_classes   text[]       not null,
    spread_markup_bps       integer      not null check (spread_markup_bps >= 0),
    logo_shape              varchar(16)  not null,
    -- theme (rendered by the clients as CSS custom properties)
    theme_primary           varchar(16)  not null,
    theme_on_primary        varchar(16)  not null,
    theme_accent            varchar(16)  not null,
    theme_background        varchar(16)  not null,
    theme_surface           varchar(16)  not null,
    theme_text              varchar(16)  not null,
    theme_muted             varchar(16)  not null,
    theme_positive          varchar(16)  not null,
    theme_negative          varchar(16)  not null,
    theme_radius            varchar(16)  not null,
    theme_color_scheme      varchar(8)   not null check (theme_color_scheme in ('light', 'dark')),
    font_body               varchar(160) not null,
    font_heading            varchar(160) not null,
    -- feature flags
    feature_trading         boolean      not null,
    feature_limit_orders    boolean      not null,
    feature_simulator_panel boolean      not null,
    feature_live_prices     boolean      not null
);

create table app_user (
    id            uuid primary key,
    tenant_id     varchar(32)  not null references tenant (id),
    email         varchar(160) not null,
    display_name  varchar(80)  not null,
    password_hash varchar(200) not null,
    roles         text[]       not null,
    unique (tenant_id, email)
);

create table instrument (
    symbol      varchar(16) primary key,
    name        varchar(80)    not null,
    asset_class varchar(16)    not null,
    exchange    varchar(16)    not null,
    currency    char(3)        not null,
    decimals    integer        not null,
    base_price  numeric(20, 8) not null
);

create table account (
    id         uuid primary key,
    tenant_id  varchar(32)    not null references tenant (id),
    user_id    varchar(64)    not null,       -- the JWT subject (works for dev IdP and corporate SSO users)
    currency   char(3)        not null,
    cash       numeric(20, 4) not null,
    created_at timestamptz    not null default now(),
    unique (tenant_id, user_id)
);

create table position (
    account_id uuid           not null references account (id),
    symbol     varchar(16)    not null references instrument (symbol),
    quantity   numeric(20, 8) not null,
    avg_price  numeric(20, 8) not null,     -- in the instrument currency
    primary key (account_id, symbol)
);

create table trade_order (
    id             uuid primary key,
    tenant_id      varchar(32)    not null references tenant (id),
    user_id        varchar(64)    not null,
    symbol         varchar(16)    not null references instrument (symbol),
    side           varchar(4)     not null check (side in ('BUY', 'SELL')),
    type           varchar(8)     not null check (type in ('MARKET', 'LIMIT')),
    quantity       numeric(20, 8) not null check (quantity > 0),
    limit_price    numeric(20, 8),
    status         varchar(12)    not null check (status in ('OPEN', 'FILLED', 'CANCELLED', 'REJECTED')),
    fill_price     numeric(20, 8),
    reject_reason  varchar(200),
    created_at     timestamptz    not null,
    updated_at     timestamptz    not null
);

create index trade_order_user_idx on trade_order (tenant_id, user_id, created_at desc);
create index trade_order_open_idx on trade_order (symbol) where status = 'OPEN';
