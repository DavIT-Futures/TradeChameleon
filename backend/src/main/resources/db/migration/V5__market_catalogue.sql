-- Market catalogue: richer instrument metadata, commodities, indices and option chains.

alter table instrument add column category      varchar(32)    not null default 'Other';
alter table instrument add column unit          varchar(24)    not null default 'unit';
alter table instrument add column contract_size numeric(20, 4) not null default 1;   -- units per contract / lot
alter table instrument add column pip_size      numeric(20, 8);                       -- FX only
alter table instrument add column optionable    boolean        not null default false;
alter table instrument add column description   varchar(200)   not null default '';

-- ---- metadata for the existing instruments ----------------------------------------------------
update instrument set category = 'Technology', unit = 'share', optionable = true,
    description = 'Consumer electronics, software and services' where symbol = 'AAPL';
update instrument set category = 'Technology', unit = 'share', optionable = true,
    description = 'Software, cloud and gaming' where symbol = 'MSFT';
update instrument set category = 'Semiconductors', unit = 'share', optionable = true,
    description = 'GPUs and accelerated computing' where symbol = 'NVDA';
update instrument set category = 'Technology', unit = 'share', description = 'Enterprise software' where symbol = 'SAP';
update instrument set category = 'Semiconductors', unit = 'share', description = 'Lithography systems' where symbol = 'ASML';
update instrument set category = 'Financials', unit = 'share', description = 'Largest Polish bank' where symbol = 'PKO';
update instrument set category = 'Gaming', unit = 'share', description = 'Video game developer' where symbol = 'CDR';
update instrument set category = 'Automotive', unit = 'share', description = 'Car manufacturer' where symbol = '7203';
update instrument set category = 'Equity ETF', unit = 'share', optionable = true,
    description = 'Tracks the S&P 500 index' where symbol = 'SPY';
update instrument set category = 'Equity ETF', unit = 'share', description = 'Global developed and emerging markets' where symbol = 'VWCE';
update instrument set category = 'Majors', unit = 'base unit', contract_size = 100000, pip_size = 0.0001,
    description = 'Euro against US dollar' where symbol = 'EURUSD';
update instrument set category = 'Majors', unit = 'base unit', contract_size = 100000, pip_size = 0.0001,
    description = 'British pound against US dollar' where symbol = 'GBPUSD';
update instrument set category = 'Exotics', unit = 'base unit', contract_size = 100000, pip_size = 0.0001,
    description = 'US dollar against Polish zloty' where symbol = 'USDPLN';
update instrument set category = 'Layer 1', unit = 'coin', optionable = true,
    description = 'The original cryptocurrency' where symbol = 'BTCUSD';
update instrument set category = 'Layer 1', unit = 'coin', description = 'Smart-contract platform' where symbol = 'ETHUSD';
update instrument set category = 'Government', unit = 'bond (100 nominal)', description = 'Polish 10-year treasury' where symbol = 'PL10Y';
update instrument set category = 'Government', unit = 'bond (100 nominal)', description = 'German 10-year Bund' where symbol = 'DE10Y';
update instrument set category = 'Government', unit = 'bond (100 nominal)', description = 'Japanese 10-year JGB' where symbol = 'JGB10Y';

-- ---- new instruments ------------------------------------------------------------------------------
insert into instrument (symbol, name, asset_class, exchange, currency, decimals, base_price,
                        category, unit, contract_size, pip_size, optionable, description) values
-- forex
('USDJPY', 'US Dollar / Japanese Yen',    'FX', 'FX', 'JPY', 3, 151.420, 'Majors',  'base unit', 100000, 0.01,   false, 'US dollar against Japanese yen'),
('AUDUSD', 'Australian Dollar / US Dollar','FX', 'FX', 'USD', 5, 0.65810, 'Majors',  'base unit', 100000, 0.0001, false, 'Australian dollar against US dollar'),
('EURGBP', 'Euro / British Pound',        'FX', 'FX', 'GBP', 5, 0.85270, 'Crosses', 'base unit', 100000, 0.0001, false, 'Euro against British pound'),
('EURPLN', 'Euro / Polish Zloty',         'FX', 'FX', 'PLN', 4, 4.31700, 'Exotics', 'base unit', 100000, 0.0001, false, 'Euro against Polish zloty'),
-- crypto
('SOLUSD', 'Solana',                      'CRYPTO', 'CRYPTO', 'USD', 2, 238.40, 'Layer 1', 'coin', 1, null, false, 'High-throughput smart-contract chain'),
('LINKUSD','Chainlink',                   'CRYPTO', 'CRYPTO', 'USD', 3, 18.420, 'Oracles', 'coin', 1, null, false, 'Decentralised oracle network'),
-- commodities
('XAUUSD', 'Gold',                        'COMMODITY', 'COMEX', 'USD', 2, 2648.30, 'Metals',      'troy oz',  100,    null, true,  'Spot gold, 1 contract = 100 troy ounces'),
('XAGUSD', 'Silver',                      'COMMODITY', 'COMEX', 'USD', 3, 31.245,  'Metals',      'troy oz',  5000,   null, false, 'Spot silver, 1 contract = 5,000 troy ounces'),
('HG',     'Copper',                      'COMMODITY', 'COMEX', 'USD', 4, 4.1250,  'Metals',      'lb',       25000,  null, false, 'Copper, 1 contract = 25,000 pounds'),
('WTI',    'Crude Oil WTI',               'COMMODITY', 'NYMEX', 'USD', 2, 69.85,   'Energy',      'barrel',   1000,   null, false, 'West Texas Intermediate, 1 contract = 1,000 barrels'),
('BRENT',  'Crude Oil Brent',             'COMMODITY', 'ICE',   'USD', 2, 73.40,   'Energy',      'barrel',   1000,   null, false, 'North Sea Brent, 1 contract = 1,000 barrels'),
('NATGAS', 'Natural Gas',                 'COMMODITY', 'NYMEX', 'USD', 3, 3.215,   'Energy',      'MMBtu',    10000,  null, false, 'Henry Hub natural gas, 1 contract = 10,000 MMBtu'),
('WHEAT',  'Wheat',                       'COMMODITY', 'CBOT',  'USD', 4, 5.4825,  'Agriculture', 'bushel',   5000,   null, false, 'Wheat, 1 contract = 5,000 bushels'),
-- indices (cash indices, value per point = contract size)
('SPX500', 'US 500',                      'INDEX', 'CME',   'USD', 1, 5998.7,  'Americas', 'index point', 10, null, true,  'Index of 500 large US companies'),
('NDX100', 'US Tech 100',                 'INDEX', 'CME',   'USD', 1, 21012.4, 'Americas', 'index point', 2,  null, true,  'Index of 100 large non-financial Nasdaq companies'),
('DAX40',  'Germany 40',                  'INDEX', 'XETRA', 'EUR', 1, 19425.6, 'Europe',   'index point', 1,  null, true,  'Index of 40 major German companies'),
('FTSE100','UK 100',                      'INDEX', 'LSE',   'GBP', 1, 8262.1,  'Europe',   'index point', 1,  null, false, 'Index of 100 large UK companies'),
('WIG20',  'Poland 20',                   'INDEX', 'GPW',   'PLN', 2, 2295.40, 'Europe',   'index point', 20, null, false, 'Index of 20 largest Warsaw companies'),
('NI225',  'Japan 225',                   'INDEX', 'TSE',   'JPY', 0, 38450,   'Asia',     'index point', 100,null, false, 'Price-weighted index of 225 Japanese companies');

-- ---- brokers get the new classes ----------------------------------------------------------------------
update tenant set allowed_asset_classes = '{STOCK,ETF,FX,CRYPTO,COMMODITY,INDEX,OPTION}' where id = 'aurora';
update tenant set allowed_asset_classes = '{STOCK,ETF,CRYPTO,INDEX,OPTION}'             where id = 'kestrel';
update tenant set allowed_asset_classes = '{STOCK,ETF,BOND,FX,COMMODITY,INDEX}'         where id = 'wisla';
update tenant set allowed_asset_classes = '{STOCK,ETF,BOND,INDEX}'                      where id = 'sakura';
