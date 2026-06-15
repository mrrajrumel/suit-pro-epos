-- =========================================================================
-- SUIT PRO LONDON - ENTERPRISE RETAIL POS DATABASE MIGRATION SCHEMA (MYSQL)
-- Target Engine: MySQL v8.0+ / MariaDB
-- Optimizations: Sub-millisecond barcode indexing and transactional integrity.
-- =========================================================================

-- 1. SYSTEM CONFIG TABLE
CREATE TABLE IF NOT EXISTS system_config (
    id INT AUTO_INCREMENT PRIMARY KEY,
    brand_name VARCHAR(255) NOT NULL DEFAULT 'SUIT PRO',
    brand_logo_url TEXT NULL,
    tax_rate_pct DECIMAL(5, 2) NOT NULL DEFAULT 20.00,
    customized_greeting TEXT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. USERS & STAFF ACCESS CONTROL (RBAC) TABLE
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(64) PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    user_role VARCHAR(50) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Optimize logins and user auditing
CREATE UNIQUE INDEX idx_users_username ON users(username);

-- Onboarding default master system owner registration: "Rumel" / Password "123456"
INSERT INTO users (id, username, password_hash, full_name, user_role)
VALUES (
    'user-owner-rumel',
    'Rumel',
    '123456',
    'Rumel Ahmed',
    'Owner'
)
ON DUPLICATE KEY UPDATE 
    password_hash = VALUES(password_hash), 
    full_name = VALUES(full_name), 
    user_role = VALUES(user_role);

-- 3. PRODUCTS TABLE
CREATE TABLE IF NOT EXISTS products (
    id VARCHAR(64) PRIMARY KEY,
    barcode_sku VARCHAR(64) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    size VARCHAR(32) NOT NULL,
    colour VARCHAR(64) NOT NULL,
    cost_price DECIMAL(10, 2) NOT NULL,
    selling_price DECIMAL(10, 2) NOT NULL,
    stock_qty INT NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Optimize queries on SKU barcodes for sub-millisecond hardware scanner resolution
CREATE UNIQUE INDEX idx_products_barcode_sku ON products(barcode_sku);

-- 4. SALES TRANSACTIONS TABLE
CREATE TABLE IF NOT EXISTS sales_transactions (
    id VARCHAR(64) PRIMARY KEY,
    invoice_id VARCHAR(128) UNIQUE NOT NULL,
    subtotal DECIMAL(10, 2) NOT NULL,
    vat_amount DECIMAL(10, 2) NOT NULL,
    total_due DECIMAL(10, 2) NOT NULL,
    payment_method VARCHAR(50) NOT NULL,
    amount_received DECIMAL(10, 2) NOT NULL,
    change_returned DECIMAL(10, 2) NOT NULL,
    remaining_balance DECIMAL(10, 2) NOT NULL,
    salesperson VARCHAR(100) NOT NULL,
    net_profit DECIMAL(10, 2) NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Optimize query indexing on invoice IDs and analytical views
CREATE UNIQUE INDEX idx_sales_transactions_invoice_id ON sales_transactions(invoice_id);
CREATE INDEX idx_sales_transactions_timestamp ON sales_transactions(timestamp);

-- 5. SALES ITEMS TABLE
CREATE TABLE IF NOT EXISTS sales_items (
    id VARCHAR(64) PRIMARY KEY,
    transaction_id VARCHAR(64) NOT NULL,
    product_id VARCHAR(64) NOT NULL,
    qty INT NOT NULL,
    item_total DECIMAL(10, 2) NOT NULL,
    FOREIGN KEY (transaction_id) REFERENCES sales_transactions(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Optimize item searches by transaction reference
CREATE INDEX idx_sales_items_transaction ON sales_items(transaction_id);

-- 6. CONNECTED ACTIVE LOCAL DEVICES LOGS
CREATE TABLE IF NOT EXISTS connected_devices (
    id INT AUTO_INCREMENT PRIMARY KEY,
    device_ip VARCHAR(50) NOT NULL,
    device_type VARCHAR(100) NOT NULL,
    user_agent TEXT NOT NULL,
    last_ping TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. SYSTEM BACKUPS TABLE
CREATE TABLE IF NOT EXISTS system_backups (
    id INT AUTO_INCREMENT PRIMARY KEY,
    file_name VARCHAR(255) NOT NULL,
    file_path TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
