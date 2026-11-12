-- Batloung Fruits Distribution Management System - MySQL schema
CREATE DATABASE IF NOT EXISTS batloung_fruits CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE batloung_fruits;

SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS order_items, orders, purchases, supplier_fruits, products, street_vendors,
  suppliers, box_sizes, fruits, provinces, user_identities, users;
SET FOREIGN_KEY_CHECKS = 1;

CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  full_name VARCHAR(100) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('administrator','sales') NOT NULL DEFAULT 'sales',
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  avatar_url VARCHAR(500) NULL,
  terms_version VARCHAR(20) NULL,       -- version of the Terms the user last accepted
  terms_accepted_at DATETIME NULL,      -- when they accepted it (recorded at every sign-in)
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Social sign-in: links a Google / GitHub / Apple / Facebook account to a user
CREATE TABLE user_identities (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  provider ENUM('google','github','apple','facebook') NOT NULL,
  provider_user_id VARCHAR(191) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_identity_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT uq_identity UNIQUE (provider, provider_user_id)
) ENGINE=InnoDB;

CREATE TABLE provinces (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE,
  code CHAR(2) NOT NULL UNIQUE
) ENGINE=InnoDB;

CREATE TABLE suppliers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  supplier_name VARCHAR(120) NOT NULL,
  province_id INT NOT NULL,
  contact_person VARCHAR(100) NOT NULL,
  telephone VARCHAR(30) NOT NULL,
  email VARCHAR(150) NOT NULL,
  physical_address VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_suppliers_province FOREIGN KEY (province_id) REFERENCES provinces(id),
  CONSTRAINT uq_supplier_name_province UNIQUE (supplier_name, province_id)
) ENGINE=InnoDB;

CREATE TABLE fruits (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(60) NOT NULL UNIQUE,
  description VARCHAR(255) NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1
) ENGINE=InnoDB;

CREATE TABLE box_sizes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name ENUM('Small','Medium','Large') NOT NULL UNIQUE,
  weight_kg DECIMAL(5,1) NOT NULL CHECK (weight_kg > 0),
  sort_order TINYINT NOT NULL DEFAULT 0
) ENGINE=InnoDB;

-- Fruit + Box Size = one saleable product configuration
CREATE TABLE products (
  id INT AUTO_INCREMENT PRIMARY KEY,
  fruit_id INT NOT NULL,
  box_size_id INT NOT NULL,
  sku VARCHAR(30) NOT NULL UNIQUE,
  selling_price DECIMAL(10,2) NOT NULL CHECK (selling_price > 0),
  stock_quantity INT NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
  reorder_threshold INT NOT NULL DEFAULT 50 CHECK (reorder_threshold >= 0),
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  CONSTRAINT fk_products_fruit FOREIGN KEY (fruit_id) REFERENCES fruits(id),
  CONSTRAINT fk_products_box FOREIGN KEY (box_size_id) REFERENCES box_sizes(id),
  CONSTRAINT uq_fruit_box UNIQUE (fruit_id, box_size_id)
) ENGINE=InnoDB;

-- Which fruits a supplier supplies
CREATE TABLE supplier_fruits (
  supplier_id INT NOT NULL,
  fruit_id INT NOT NULL,
  PRIMARY KEY (supplier_id, fruit_id),
  CONSTRAINT fk_sf_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE CASCADE,
  CONSTRAINT fk_sf_fruit FOREIGN KEY (fruit_id) REFERENCES fruits(id)
) ENGINE=InnoDB;

CREATE TABLE purchases (
  id INT AUTO_INCREMENT PRIMARY KEY,
  supplier_id INT NOT NULL,
  product_id INT NOT NULL,
  quantity INT NOT NULL CHECK (quantity > 0),
  cost_per_box DECIMAL(10,2) NOT NULL CHECK (cost_per_box >= 0),
  batch_no VARCHAR(40) NOT NULL,
  purchase_date DATE NOT NULL,
  created_by INT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_purchases_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
  CONSTRAINT fk_purchases_product FOREIGN KEY (product_id) REFERENCES products(id),
  CONSTRAINT fk_purchases_user FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE street_vendors (
  id INT AUTO_INCREMENT PRIMARY KEY,
  vendor_name VARCHAR(100) NOT NULL,
  business_name VARCHAR(120) NOT NULL,
  telephone VARCHAR(30) NOT NULL,
  location_area VARCHAR(100) NOT NULL,
  latitude DECIMAL(10,7) NULL,
  longitude DECIMAL(10,7) NULL,
  registration_date DATE NOT NULL,
  status ENUM('Active','Inactive') NOT NULL DEFAULT 'Active'
) ENGINE=InnoDB;

CREATE TABLE orders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  vendor_id INT NOT NULL,
  order_date DATE NOT NULL,
  status ENUM('Pending','Confirmed','Processing','Ready for Collection/Delivery','Completed','Cancelled')
    NOT NULL DEFAULT 'Pending',
  total_amount DECIMAL(12,2) NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
  created_by INT NULL,
  completed_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_orders_vendor FOREIGN KEY (vendor_id) REFERENCES street_vendors(id),
  CONSTRAINT fk_orders_user FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_orders_status (status),
  INDEX idx_orders_date (order_date)
) ENGINE=InnoDB;

CREATE TABLE order_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_id INT NOT NULL,
  product_id INT NOT NULL,
  quantity INT NOT NULL CHECK (quantity > 0),
  unit_price DECIMAL(10,2) NOT NULL CHECK (unit_price > 0),
  subtotal DECIMAL(12,2) NOT NULL,
  CONSTRAINT fk_items_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  CONSTRAINT fk_items_product FOREIGN KEY (product_id) REFERENCES products(id)
) ENGINE=InnoDB;
