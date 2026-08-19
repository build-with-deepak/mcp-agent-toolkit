-- Idempotent schema + sample dataset, applied on every API boot.
--
-- The dataset is a small commerce domain chosen so multi-tool questions
-- come naturally: customers have CITIES (join against the weather tool),
-- orders have amounts (feed the calculator), and the shape is familiar
-- enough that a visitor can invent their own questions without reading a
-- schema doc. Fixed IDs + ON CONFLICT DO NOTHING make re-running this a
-- no-op rather than a duplicate-data generator.
--
-- The mcp_readonly role's creation lives in db.service.ts (a password
-- can't be parameterized inside a static SQL file); the GRANTs live here
-- so the privilege surface is reviewable next to the tables it covers.

CREATE TABLE IF NOT EXISTS customers (
  id         integer PRIMARY KEY,
  name       text NOT NULL,
  city       text NOT NULL,
  country    text NOT NULL,
  created_at date NOT NULL
);

CREATE TABLE IF NOT EXISTS products (
  id         integer PRIMARY KEY,
  name       text NOT NULL,
  category   text NOT NULL,
  price_usd  numeric(10,2) NOT NULL
);

CREATE TABLE IF NOT EXISTS orders (
  id          integer PRIMARY KEY,
  customer_id integer NOT NULL REFERENCES customers(id),
  ordered_at  date NOT NULL,
  status      text NOT NULL CHECK (status IN ('pending','shipped','delivered','cancelled'))
);

CREATE TABLE IF NOT EXISTS order_items (
  order_id       integer NOT NULL REFERENCES orders(id),
  product_id     integer NOT NULL REFERENCES products(id),
  quantity       integer NOT NULL,
  unit_price_usd numeric(10,2) NOT NULL,
  PRIMARY KEY (order_id, product_id)
);

INSERT INTO customers (id, name, city, country, created_at) VALUES
  (1,  'Al Noor Trading',      'Dubai',     'United Arab Emirates', '2024-03-12'),
  (2,  'Falcon Logistics',     'Dubai',     'United Arab Emirates', '2024-06-01'),
  (3,  'Oasis Retail Group',   'Abu Dhabi', 'United Arab Emirates', '2024-08-19'),
  (4,  'Ganga Textiles',       'New Delhi', 'India',                '2024-01-25'),
  (5,  'Lotus Electronics',    'New Delhi', 'India',                '2024-05-07'),
  (6,  'Marina Foods',         'Mumbai',    'India',                '2024-09-14'),
  (7,  'Thames Analytics',     'London',    'United Kingdom',       '2024-02-03'),
  (8,  'Borough Supplies',     'London',    'United Kingdom',       '2024-11-22'),
  (9,  'Hudson Hardware',      'New York',  'United States',        '2024-04-30'),
  (10, 'Liberty Media Co',     'New York',  'United States',        '2024-07-16'),
  (11, 'Merlion Systems',      'Singapore', 'Singapore',            '2024-10-05'),
  (12, 'Harbour Fresh',        'Singapore', 'Singapore',            '2025-01-11'),
  (13, 'Sakura Imports',       'Tokyo',     'Japan',                '2025-02-28'),
  (14, 'Edo Craft Supply',     'Tokyo',     'Japan',                '2025-04-09'),
  (15, 'Pearl Coast Trading',  'Dubai',     'United Arab Emirates', '2025-05-21')
ON CONFLICT (id) DO NOTHING;

INSERT INTO products (id, name, category, price_usd) VALUES
  (1,  'Wireless Barcode Scanner',   'Hardware',    89.00),
  (2,  'Thermal Label Printer',      'Hardware',   199.00),
  (3,  'Industrial Tablet 10"',      'Hardware',   449.00),
  (4,  'Warehouse Shelving Unit',    'Equipment',  129.50),
  (5,  'Pallet Jack',                'Equipment',  319.00),
  (6,  'Inventory SaaS (annual)',    'Software',   588.00),
  (7,  'Route Planning SaaS (annual)','Software',  948.00),
  (8,  'POS Terminal',               'Hardware',   275.00),
  (9,  'Receipt Paper (case)',       'Consumables', 42.00),
  (10, 'Shipping Boxes (bundle)',    'Consumables', 36.50),
  (11, 'Cold-Chain Sensor Kit',      'Hardware',   156.00),
  (12, 'Fleet GPS Tracker',          'Hardware',    98.00)
ON CONFLICT (id) DO NOTHING;

INSERT INTO orders (id, customer_id, ordered_at, status) VALUES
  (1,  1,  '2025-01-15', 'delivered'), (2,  1,  '2025-03-02', 'delivered'),
  (3,  1,  '2025-06-18', 'shipped'),   (4,  2,  '2025-02-09', 'delivered'),
  (5,  2,  '2025-05-27', 'delivered'), (6,  2,  '2025-08-01', 'pending'),
  (7,  3,  '2025-04-11', 'delivered'), (8,  3,  '2025-07-23', 'cancelled'),
  (9,  4,  '2025-01-30', 'delivered'), (10, 4,  '2025-04-15', 'delivered'),
  (11, 5,  '2025-03-19', 'delivered'), (12, 5,  '2025-06-05', 'shipped'),
  (13, 6,  '2025-02-14', 'delivered'), (14, 6,  '2025-07-08', 'delivered'),
  (15, 7,  '2025-01-07', 'delivered'), (16, 7,  '2025-05-12', 'delivered'),
  (17, 8,  '2025-03-28', 'delivered'), (18, 8,  '2025-08-10', 'pending'),
  (19, 9,  '2025-02-21', 'delivered'), (20, 9,  '2025-06-30', 'shipped'),
  (21, 10, '2025-04-04', 'delivered'), (22, 10, '2025-07-17', 'delivered'),
  (23, 11, '2025-01-23', 'delivered'), (24, 11, '2025-05-09', 'delivered'),
  (25, 12, '2025-03-14', 'delivered'), (26, 12, '2025-08-05', 'pending'),
  (27, 13, '2025-04-26', 'delivered'), (28, 13, '2025-06-12', 'cancelled'),
  (29, 14, '2025-05-31', 'delivered'), (30, 15, '2025-07-02', 'shipped'),
  (31, 15, '2025-08-14', 'pending'),   (32, 4,  '2025-08-09', 'delivered')
ON CONFLICT (id) DO NOTHING;

INSERT INTO order_items (order_id, product_id, quantity, unit_price_usd) VALUES
  (1, 1, 4, 89.00),  (1, 9, 10, 42.00), (2, 2, 2, 199.00), (2, 10, 6, 36.50),
  (3, 3, 3, 449.00), (4, 5, 1, 319.00), (4, 4, 4, 129.50), (5, 7, 1, 948.00),
  (6, 12, 8, 98.00), (7, 8, 2, 275.00), (7, 9, 5, 42.00),  (8, 6, 1, 588.00),
  (9, 1, 2, 89.00),  (9, 10, 8, 36.50), (10, 6, 1, 588.00),(11, 3, 1, 449.00),
  (11, 9, 4, 42.00), (12, 11, 3, 156.00),(13, 4, 6, 129.50),(14, 5, 2, 319.00),
  (15, 7, 1, 948.00),(16, 2, 3, 199.00),(17, 1, 5, 89.00), (18, 12, 10, 98.00),
  (19, 8, 1, 275.00),(20, 3, 2, 449.00),(21, 6, 1, 588.00),(22, 9, 12, 42.00),
  (23, 11, 2, 156.00),(24, 7, 1, 948.00),(25, 10, 15, 36.50),(26, 1, 3, 89.00),
  (27, 2, 1, 199.00),(28, 4, 2, 129.50),(29, 5, 1, 319.00),(30, 3, 4, 449.00),
  (31, 12, 6, 98.00),(32, 11, 5, 156.00)
ON CONFLICT (order_id, product_id) DO NOTHING;

-- Read-only privilege surface for the agent's DB tool. The role itself is
-- created in db.service.ts; these grants are idempotent.
GRANT USAGE ON SCHEMA public TO mcp_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO mcp_readonly;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO mcp_readonly;
