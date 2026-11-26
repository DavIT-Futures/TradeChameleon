-- Four fictional brokers sharing one code base. Deterministic seed data: no random values.

insert into tenant values
('aurora', 'Aurora Markets', 'Trade under the northern lights', 'en-GB', 'GBP',
 '{STOCK,ETF,FX,CRYPTO}', 5, 'aurora',
 '#0f766e', '#ffffff', '#f59e0b', '#f3f6f5', '#ffffff', '#0f1f1c', '#5b6b67', '#15803d', '#b91c1c', '12px', 'light',
 '"Segoe UI", "Inter", system-ui, sans-serif', '"Segoe UI Semibold", "Inter", system-ui, sans-serif',
 true, true, true, true),

('kestrel', 'Kestrel Trade', 'Precision brokerage for fast hands', 'de-DE', 'EUR',
 '{STOCK,ETF,CRYPTO}', 12, 'kestrel',
 '#818cf8', '#0b1020', '#22d3ee', '#0b1020', '#141b2d', '#e6e9f2', '#8b93a7', '#34d399', '#f87171', '4px', 'dark',
 '"IBM Plex Sans", "Segoe UI", system-ui, sans-serif', '"Cascadia Mono", "IBM Plex Mono", ui-monospace, monospace',
 true, true, true, true),

('wisla', 'Wisła Invest', 'Inwestuj z głową, od Tatr po Bałtyk', 'pl-PL', 'PLN',
 '{STOCK,ETF,BOND,FX}', 20, 'wisla',
 '#b91c1c', '#ffffff', '#1d4ed8', '#fbf8f3', '#ffffff', '#1f1a17', '#6b625c', '#15803d', '#b91c1c', '2px', 'light',
 '"Segoe UI", Roboto, system-ui, sans-serif', 'Georgia, "Times New Roman", serif',
 true, false, true, true),

('sakura', 'Sakura Wealth', 'Portfolio clarity, season after season', 'ja-JP', 'JPY',
 '{STOCK,ETF,BOND}', 0, 'sakura',
 '#db2777', '#ffffff', '#7c3aed', '#fff7fa', '#ffffff', '#2a1720', '#7a6070', '#15803d', '#be123c', '20px', 'light',
 '"Yu Gothic UI", "Hiragino Sans", "Segoe UI", sans-serif', '"Yu Gothic UI Semibold", "Hiragino Sans", "Segoe UI", sans-serif',
 false, false, false, true);

insert into instrument values
('AAPL',   'Apple Inc.',                 'STOCK',  'NASDAQ',   'USD', 2, 228.50),
('MSFT',   'Microsoft Corp.',            'STOCK',  'NASDAQ',   'USD', 2, 415.20),
('NVDA',   'NVIDIA Corp.',               'STOCK',  'NASDAQ',   'USD', 2, 142.80),
('SAP',    'SAP SE',                     'STOCK',  'XETRA',    'EUR', 2, 236.40),
('ASML',   'ASML Holding',               'STOCK',  'EURONEXT', 'EUR', 2, 712.00),
('PKO',    'PKO Bank Polski',            'STOCK',  'GPW',      'PLN', 2, 58.34),
('CDR',    'CD Projekt',                 'STOCK',  'GPW',      'PLN', 2, 215.60),
('7203',   'Toyota Motor',               'STOCK',  'TSE',      'JPY', 0, 2850),
('SPY',    'SPDR S&P 500 ETF',           'ETF',    'NYSE',     'USD', 2, 598.10),
('VWCE',   'Vanguard FTSE All-World',    'ETF',    'XETRA',    'EUR', 2, 128.40),
('EURUSD', 'Euro / US Dollar',           'FX',     'FX',       'USD', 5, 1.08420),
('GBPUSD', 'British Pound / US Dollar',  'FX',     'FX',       'USD', 5, 1.27150),
('USDPLN', 'US Dollar / Polish Zloty',   'FX',     'FX',       'PLN', 4, 3.98200),
('BTCUSD', 'Bitcoin',                    'CRYPTO', 'CRYPTO',   'USD', 2, 97250.00),
('ETHUSD', 'Ether',                      'CRYPTO', 'CRYPTO',   'USD', 2, 3420.00),
('PL10Y',  'Poland 10Y Government Bond', 'BOND',   'GPW',      'PLN', 3, 98.450),
('DE10Y',  'German Bund 10Y',            'BOND',   'XETRA',    'EUR', 3, 101.200),
('JGB10Y', 'Japan 10Y Government Bond',  'BOND',   'TSE',      'JPY', 3, 99.800);
