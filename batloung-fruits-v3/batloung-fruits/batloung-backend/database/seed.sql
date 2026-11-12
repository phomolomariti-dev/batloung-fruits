USE batloung_fruits;

INSERT INTO provinces (name, code) VALUES
('Eastern Cape','EC'),('Free State','FS'),('Gauteng','GP'),('KwaZulu-Natal','KZ'),('Limpopo','LP'),
('Mpumalanga','MP'),('Northern Cape','NC'),('North West','NW'),('Western Cape','WC');

INSERT INTO fruits (name, description) VALUES
('Apples','Royal Gala, Fuji and Granny Smith'),
('Bananas','Cavendish Grade A'),
('Oranges','Valencia and Navel'),
('Mangoes','Tommy Atkins and Kent'),
('Grapes','Crimson and Thompson Seedless');

INSERT INTO box_sizes (name, weight_kg, sort_order) VALUES ('Small',5,1),('Medium',10,2),('Large',18,3);

-- 5 fruits x 3 box sizes = 15 products (prices in ZAR / LSL, 1:1 peg)
INSERT INTO products (fruit_id, box_size_id, sku, selling_price, reorder_threshold)
SELECT f.id, b.id,
  CONCAT('SKU-', UPPER(LEFT(f.name,3)), '-', UPPER(LEFT(b.name,3))),
  ROUND(CASE f.name WHEN 'Apples' THEN 70 WHEN 'Bananas' THEN 55 WHEN 'Oranges' THEN 50
        WHEN 'Mangoes' THEN 85 ELSE 95 END * (b.weight_kg / 5) * 0.9, 0),
  CASE b.name WHEN 'Small' THEN 100 WHEN 'Medium' THEN 150 ELSE 80 END
FROM fruits f CROSS JOIN box_sizes b;

INSERT INTO suppliers (supplier_name, province_id, contact_person, telephone, email, physical_address)
SELECT * FROM (
 SELECT 'Ceres Valley Orchards', (SELECT id FROM provinces WHERE name='Western Cape'), 'Pieter van der Merwe', '+27 23 312 8841', 'pieter@ceresvalley.co.za', 'Farm 412, Voortrekker Rd, Ceres' UNION ALL
 SELECT 'Hex River Table Grapes', (SELECT id FROM provinces WHERE name='Western Cape'), 'Anel Joubert', '+27 23 356 1120', 'anel@hexgrapes.co.za', 'Plot 7, De Doorns' UNION ALL
 SELECT 'Tzaneen Tropical Citrus', (SELECT id FROM provinces WHERE name='Limpopo'), 'Grace Maluleke', '+27 15 307 4109', 'g.maluleke@tzaneencitrus.co.za', 'Plot 18 Letsitele Valley, Tzaneen' UNION ALL
 SELECT 'Nelspruit Subtropical Co-op', (SELECT id FROM provinces WHERE name='Mpumalanga'), 'Johan Botha', '+27 13 755 9210', 'orders@nelspruitcoop.org.za', '12 Citrus Crescent, Mbombela' UNION ALL
 SELECT 'Maluti Mountain Orchards', (SELECT id FROM provinces WHERE name='Free State'), 'Lerato Mokoena', '+27 58 303 2217', 'lerato@malutiorchards.co.za', 'R26 Road, Ficksburg' UNION ALL
 SELECT 'Sundays River Citrus Co', (SELECT id FROM provinces WHERE name='Eastern Cape'), 'Sipho Ndlovu', '+27 42 230 1188', 'sipho@sundaysriver.co.za', 'Kirkwood Citrus Estate, Kirkwood' UNION ALL
 SELECT 'Kakamas Grape Growers', (SELECT id FROM provinces WHERE name='Northern Cape'), 'Marissa Pienaar', '+27 54 431 0095', 'marissa@kakamasgrapes.co.za', 'Orange River Rd, Kakamas' UNION ALL
 SELECT 'Durban Tropical Fruit', (SELECT id FROM provinces WHERE name='KwaZulu-Natal'), 'Nomsa Dlamini', '+27 31 502 7741', 'nomsa@durbantropical.co.za', '41 Umgeni Rd, Durban' UNION ALL
 SELECT 'Highveld Orchard Co-op', (SELECT id FROM provinces WHERE name='Gauteng'), 'Lerato Dube', '+27 11 555 0101', 'lerato.dube@example.com', '14 Orchard Lane, Johannesburg' UNION ALL
 SELECT 'Karoo Sun Produce', (SELECT id FROM provinces WHERE name='North West'), 'Kabelo Mokoena', '+27 18 555 0102', 'kabelo.mokoena@example.com', '8 Market Road, Rustenburg' UNION ALL
 SELECT 'Borderlands Fresh Fruit', (SELECT id FROM provinces WHERE name='Free State'), 'Masechaba Khumalo', '+27 51 555 0103', 'masechaba.khumalo@example.com', '22 Farm Road, Bloemfontein' UNION ALL
 SELECT 'Midlands Orchard Supply', (SELECT id FROM provinces WHERE name='KwaZulu-Natal'), 'Sibusiso Zulu', '+27 33 555 0104', 'sibusiso.zulu@example.com', '5 Harvest Way, Pietermaritzburg'
) s;

INSERT INTO supplier_fruits (supplier_id, fruit_id)
SELECT s.id, f.id FROM suppliers s JOIN fruits f ON
 (s.supplier_name='Ceres Valley Orchards' AND f.name IN ('Apples','Grapes')) OR
 (s.supplier_name='Hex River Table Grapes' AND f.name = 'Grapes') OR
 (s.supplier_name='Tzaneen Tropical Citrus' AND f.name IN ('Oranges','Bananas','Mangoes')) OR
 (s.supplier_name='Nelspruit Subtropical Co-op' AND f.name IN ('Bananas','Oranges','Mangoes','Apples')) OR
 (s.supplier_name='Maluti Mountain Orchards' AND f.name = 'Apples') OR
 (s.supplier_name='Sundays River Citrus Co' AND f.name = 'Oranges') OR
 (s.supplier_name='Kakamas Grape Growers' AND f.name = 'Grapes') OR
 (s.supplier_name='Durban Tropical Fruit' AND f.name IN ('Bananas','Mangoes')) OR
 (s.supplier_name='Highveld Orchard Co-op' AND f.name IN ('Apples','Grapes')) OR
 (s.supplier_name='Karoo Sun Produce' AND f.name IN ('Oranges','Mangoes')) OR
 (s.supplier_name='Borderlands Fresh Fruit' AND f.name IN ('Apples','Oranges')) OR
 (s.supplier_name='Midlands Orchard Supply' AND f.name IN ('Bananas','Mangoes'));

-- Opening stock purchases (one per product, from a supplier that supplies that fruit)
INSERT INTO purchases (supplier_id, product_id, quantity, cost_per_box, batch_no, purchase_date)
SELECT (SELECT sf.supplier_id FROM supplier_fruits sf WHERE sf.fruit_id = p.fruit_id ORDER BY sf.supplier_id LIMIT 1),
  p.id, 200 + (p.id * 17) % 150, ROUND(p.selling_price * 0.65, 2),
  CONCAT('CON-2026-', LPAD(p.id, 4, '0')), DATE_SUB(CURDATE(), INTERVAL (p.id % 20) + 10 DAY)
FROM products p;

INSERT INTO street_vendors (vendor_name, business_name, telephone, location_area, registration_date, status) VALUES
('Thabo Nkosi','Thabo Fruit Stall','+266 5801 2345','Maseru CBD','2026-01-12','Active'),
('Mpho Letsie','Mpho Fruit Stall','+266 5802 7788','Maseru West','2026-02-03','Active'),
('Lineo Mohapi','Lineo Fruit Corner','+266 6203 4411','Thetsane','2026-02-19','Active'),
('Tsepo Molapo','Kingsway Fruit Stop','+266 5944 1020','Kingsway','2026-03-08','Active'),
('Palesa Ramokhele','Palesa Fresh Fruit','+266 6310 9987','Hillsview','2026-04-21','Active'),
('Teboho Mofokeng','Teboho Roadside Fruit','+266 5877 3321','Maseru East','2026-05-30','Inactive'),
('Khotso Phiri','Maseru Market Fruits','+266 5803 1101','Maseru CBD','2026-06-12','Active'),
('Nthabiseng Rantso','Sunrise Fruit Stand','+266 6204 2202','Thetsane','2026-07-04','Active'),
('Mohau Ntoi','Fresh Pick Corner','+266 5945 3303','Maseru West','2026-08-18','Active'),
('Refiloe Makoa','Mountain View Produce','+266 6311 4404','Hillsview','2026-09-02','Active');

-- Sample orders (explicit ids so items can reference them)
INSERT INTO orders (id, vendor_id, order_date, status) VALUES
(1,1,DATE_SUB(CURDATE(), INTERVAL 12 DAY),'Completed'),
(2,2,DATE_SUB(CURDATE(), INTERVAL 10 DAY),'Completed'),
(3,3,DATE_SUB(CURDATE(), INTERVAL 8 DAY),'Completed'),
(4,1,DATE_SUB(CURDATE(), INTERVAL 6 DAY),'Completed'),
(5,4,DATE_SUB(CURDATE(), INTERVAL 5 DAY),'Completed'),
(6,5,DATE_SUB(CURDATE(), INTERVAL 3 DAY),'Cancelled'),
(7,2,DATE_SUB(CURDATE(), INTERVAL 2 DAY),'Processing'),
(8,3,DATE_SUB(CURDATE(), INTERVAL 1 DAY),'Confirmed'),
(9,4,CURDATE(),'Pending'),
(10,1,CURDATE(),'Pending');
UPDATE orders SET completed_at = order_date WHERE status = 'Completed';

CREATE TEMPORARY TABLE tmp_items (order_id INT, sku VARCHAR(30), qty INT);
INSERT INTO tmp_items VALUES
(1,'SKU-APP-MED',30),(1,'SKU-ORA-SMA',20),
(2,'SKU-BAN-LAR',25),(2,'SKU-MAN-MED',15),
(3,'SKU-GRA-SMA',12),(3,'SKU-APP-LAR',10),
(4,'SKU-ORA-MED',40),(4,'SKU-BAN-MED',20),
(5,'SKU-MAN-SMA',18),(5,'SKU-GRA-MED',14),
(6,'SKU-APP-SMA',50),
(7,'SKU-BAN-SMA',35),(7,'SKU-ORA-LAR',10),
(8,'SKU-APP-MED',22),
(9,'SKU-GRA-LAR',8),(9,'SKU-MAN-LAR',9),
(10,'SKU-ORA-MED',30);
INSERT INTO order_items (order_id, product_id, quantity, unit_price, subtotal)
SELECT t.order_id, p.id, t.qty, p.selling_price, t.qty * p.selling_price FROM tmp_items t JOIN products p ON p.sku = t.sku;
DROP TEMPORARY TABLE tmp_items;

UPDATE orders o SET total_amount = (SELECT COALESCE(SUM(subtotal),0) FROM order_items oi WHERE oi.order_id = o.id);

-- stock on hand = everything purchased minus boxes in COMPLETED orders (cancelled/open orders never reduce stock)
UPDATE products p SET stock_quantity =
  (SELECT COALESCE(SUM(quantity),0) FROM purchases pu WHERE pu.product_id = p.id)
  - (SELECT COALESCE(SUM(oi.quantity),0) FROM order_items oi JOIN orders o ON o.id = oi.order_id WHERE oi.product_id = p.id AND o.status = 'Completed');

-- Demo users (so importing the SQL files by hand also gives you working logins).
-- Admin: admin@batloung.co.ls / Admin@123    Sales: sales@batloung.co.ls / Sales@123
INSERT INTO users (full_name, email, password_hash, role, is_active) VALUES
  ('Admin User', 'admin@batloung.co.ls', '$2a$10$YWDCnqZN/J6sbD1pGuKjt.aGOLgzWyHPyI2hmegh2tNoVVCF2/8pC', 'administrator', 1),
  ('Thabo Nkosi (Sales)', 'sales@batloung.co.ls', '$2a$10$11ulV0HrxcmXKcdRoeuc4OHbm2SuvnMrBAMJ.9pWVuGX9XxOxtMx.', 'sales', 1)
ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash), role = VALUES(role), is_active = 1;
