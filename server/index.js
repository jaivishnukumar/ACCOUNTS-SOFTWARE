const express = require('express');
const cors = require('cors');
const Database = require('better-sqlite3');
const path = require('node:path');
const fs = require('node:fs');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

dotenv.config();

const app = express();
const port = process.env.PORT || 5002;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Middleware
app.use(cors());
app.use(express.json());

// Health check endpoint for Render
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(__dirname, '../client/dist')));
}

// Database Setup
const dbPath = path.join(__dirname, 'sales_app.db');
const db = new Database(dbPath);

// Migration Helper
const addColumn = (table, col, type) => {
    try {
        db.prepare(`ALTER TABLE ${table} ADD COLUMN ${col} ${type} `).run();
    } catch (e) {
        // Ignore if column likely exists
    }
};

// Ensure new columns exist
addColumn('products', 'maintain_stock', 'INTEGER DEFAULT 1');
addColumn('products', 'has_dual_units', 'INTEGER DEFAULT 0');
addColumn('products', 'secondary_unit', 'TEXT');
addColumn('products', 'conversion_rate', 'REAL DEFAULT 1.0');
addColumn('sales', 'product_id', 'INTEGER'); // Link Sales to Specific Product
addColumn('sales', 'unit', 'TEXT'); // Ensure unit exists (it was in CREATE but good to be safe)
addColumn('purchases', 'product_id', 'INTEGER'); // Link Purchases to Specific Product

// Initialize Tables
db.exec(`
  CREATE TABLE IF NOT EXISTS companies(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    address TEXT,
    gst_number TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

  CREATE TABLE IF NOT EXISTS parties(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id INTEGER,
    name TEXT NOT NULL,
    gst_number TEXT,
    address TEXT,
    contact TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(company_id) REFERENCES companies(id)
);

  CREATE TABLE IF NOT EXISTS users(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    role TEXT DEFAULT 'user',
    is_approved INTEGER DEFAULT 0, --0: Pending, 1: Approved, 2: Blocked
    max_companies INTEGER DEFAULT 5,
    allowed_years TEXT DEFAULT 'all', -- 'all' or comma - separated list '2024-2025,2025-2026'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

  CREATE TABLE IF NOT EXISTS invite_codes(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL UNIQUE,
    is_used INTEGER DEFAULT 0,
    created_by TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

  CREATE TABLE IF NOT EXISTS sales(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id INTEGER,
    financial_year TEXT,
    date TEXT NOT NULL,
    bill_no TEXT NOT NULL,
    party_id INTEGER,
    bill_value REAL,
    bags INTEGER,
    hsn_code TEXT,
    tax_rate REAL,
    cgst REAL,
    sgst REAL,
    total REAL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(party_id) REFERENCES parties(id),
    FOREIGN KEY(company_id) REFERENCES companies(id)
);

  CREATE TABLE IF NOT EXISTS hsn_codes(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id INTEGER,
    code TEXT NOT NULL,
    description TEXT,
    rate REAL NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(company_id) REFERENCES companies(id)
);

  CREATE TABLE IF NOT EXISTS products(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id INTEGER,
    name TEXT NOT NULL,
    hsn_code TEXT NOT NULL,
    tax_rate REAL NOT NULL,
    packing_type TEXT DEFAULT 'BAG',
    maintain_stock INTEGER DEFAULT 1,
    has_dual_units INTEGER DEFAULT 0,
    secondary_unit TEXT,
    conversion_rate REAL DEFAULT 1.0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(company_id) REFERENCES companies(id)
);

  CREATE TABLE IF NOT EXISTS product_formulas(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL,
    ingredient_id INTEGER NOT NULL,
    quantity REAL NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(product_id) REFERENCES products(id),
    FOREIGN KEY(ingredient_id) REFERENCES products(id)
);

  CREATE TABLE IF NOT EXISTS purchases(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id INTEGER,
    financial_year TEXT,
    date TEXT NOT NULL,
    bill_no TEXT NOT NULL,
    received_date TEXT,
    party_id INTEGER,
    gst_number TEXT,
    hsn_code TEXT,
    quantity REAL,
    unit TEXT,
    taxable_value REAL,
    tax_rate REAL,
    cgst REAL,
    sgst REAL,
    bill_value REAL,
    freight_charges REAL,
    loading_charges REAL,
    unloading_charges REAL,
    auto_charges REAL,
    expenses_total REAL,
    rcm_tax_payable REAL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(party_id) REFERENCES parties(id),
    FOREIGN KEY(company_id) REFERENCES companies(id)
);


  CREATE TABLE IF NOT EXISTS stock_ledger(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id INTEGER,
    date TEXT NOT NULL,
    product_id INTEGER NOT NULL,
    transaction_type TEXT NOT NULL, -- 'PURCHASE', 'SALE', 'PRODUCTION_IN', 'PRODUCTION_OUT', 'OPENING'
    related_id INTEGER, --ID of purchase / sale / production entry
    quantity_in REAL DEFAULT 0,
    quantity_out REAL DEFAULT 0,
    rate REAL DEFAULT 0,
    batch_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(product_id) REFERENCES products(id),
    FOREIGN KEY(company_id) REFERENCES companies(id)
);

  CREATE TABLE IF NOT EXISTS production_logs(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id INTEGER,
    date TEXT NOT NULL,
    batch_no TEXT,
    output_product_id INTEGER NOT NULL,
    output_quantity REAL NOT NULL,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(output_product_id) REFERENCES products(id),
    FOREIGN KEY(company_id) REFERENCES companies(id)
);

  CREATE TABLE IF NOT EXISTS production_items(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    production_id INTEGER NOT NULL,
    input_product_id INTEGER NOT NULL,
    input_quantity REAL NOT NULL,
    FOREIGN KEY(production_id) REFERENCES production_logs(id) ON DELETE CASCADE,
    FOREIGN KEY(input_product_id) REFERENCES products(id)
);
`);

// Migrations
try {
    const defaultCompany = db.prepare("SELECT * FROM companies WHERE id = 1").get();
    if (!defaultCompany) {
        db.prepare("INSERT INTO companies (id, name, address, gst_number) VALUES (1, 'Default Company', 'Default Address', '')").run();
    }
} catch (e) {
    console.error("Migration/Setup Error:", e);
}

const safeColumnAdd = (table, column, type, defaultVal = null) => {
    const columns = db.prepare(`PRAGMA table_info(${table})`).all();
    const columnExists = columns.some(col => col.name === column);

    if (!columnExists) {
        try {
            db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type} `);
            if (defaultVal !== null) {
                db.exec(`UPDATE ${table} SET ${column} = ${defaultVal} WHERE ${column} IS NULL`);
            }
        } catch (e) {
            console.error(`Error adding column ${column} to table ${table}: `, e);
        }
    }
};

safeColumnAdd('sales', 'tax_rate', 'REAL');
safeColumnAdd('sales', 'company_id', 'INTEGER', 1);
safeColumnAdd('sales', 'financial_year', 'TEXT', "'2024-2025'");
safeColumnAdd('sales', 'unit', 'TEXT', "'BAG'");
safeColumnAdd('parties', 'company_id', 'INTEGER', 1);
safeColumnAdd('products', 'packing_type', 'TEXT', "'BAG'");
safeColumnAdd('purchases', 'auto_charges', 'REAL', 0);
safeColumnAdd('purchases', 'expenses_total', 'REAL', 0);
safeColumnAdd('purchases', 'rcm_tax_payable', 'REAL', 0);
safeColumnAdd('purchases', 'conversion_factor', 'REAL', 1.0);
safeColumnAdd('purchases', 'round_off', 'REAL', 0);
safeColumnAdd('sales', 'conversion_factor', 'REAL', 1.0);
safeColumnAdd('product_formulas', 'unit_type', 'TEXT', "'primary'");
safeColumnAdd('stock_ledger', 'trans_unit', 'TEXT');
safeColumnAdd('stock_ledger', 'trans_conversion_factor', 'REAL', 1.0);
safeColumnAdd('products', 'formula_base_qty', 'INTEGER', 1);

// Migrate HSN Codes to Products
const migrateHSNToProducts = () => {
    try {
        const productsCount = db.prepare('SELECT COUNT(*) as count FROM products').get().count;
        if (productsCount === 0) {
            const hsnCodes = db.prepare('SELECT * FROM hsn_codes').all();
            const insert = db.prepare('INSERT INTO products (company_id, name, hsn_code, tax_rate, packing_type) VALUES (?, ?, ?, ?, ?)');
            const transaction = db.transaction((codes) => {
                for (const hsn of codes) {
                    insert.run(hsn.company_id, hsn.description || `Product ${hsn.code} `, hsn.code, hsn.rate, 'BAG');
                }
            });
            transaction(hsnCodes);
            console.log(`Migrated ${hsnCodes.length} HSN codes to Products`);
        }
    } catch (e) {
        console.error("HSN Migration Error:", e);
    }
};
migrateHSNToProducts();

// Routes
app.get('/', (req, res) => {
    res.send('Sales App Backend Running');
});

// Authentication Middleware
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.sendStatus(401);

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: 'Invalid token' });
        req.user = user;
        next();
    });
};

// Auth Routes

// Initialize Admin User and migration
const init = async () => {
    // Migration for existing tables
    try {
        safeColumnAdd('users', 'is_approved', 'INTEGER', 0);
        safeColumnAdd('users', 'max_companies', 'INTEGER', 5);
        safeColumnAdd('users', 'allowed_years', 'TEXT', "'all'");
    } catch (e) {
        // Ignored if columns exist
    }

    // Ensure Super Admin 'vishnu' exists
    const admin = db.prepare('SELECT * FROM users WHERE username = ?').get('vishnu');
    if (!admin) {
        const hashedPassword = await bcrypt.hash('admin123', 10); // Default password, change immediately
        db.prepare('INSERT INTO users (username, password, role, is_approved, max_companies) VALUES (?, ?, ?, ?, ?)').run('vishnu', hashedPassword, 'admin', 1, 100);
        console.log("Super Admin 'vishnu' created.");
    } else {
        // Ensure role is admin
        db.prepare('UPDATE users SET role = ?, is_approved = 1 WHERE username = ?').run('admin', 'vishnu');
    }
}
init();

app.post('/api/register', async (req, res) => {
    const { username, password, inviteCode } = req.body;

    // Check Invite Code
    if (!inviteCode) return res.status(400).json({ error: 'Invite Code required' });
    const code = db.prepare('SELECT * FROM invite_codes WHERE code = ? AND is_used = 0').get(inviteCode);

    // Bypass for first user/admin setup if needed, but per request strict code required. 
    // Except 'vishnu' is pre-seeded. 
    if (!code) return res.status(400).json({ error: 'Invalid or Used Invite Code' });

    try {
        const hashedPassword = await bcrypt.hash(password, 10);

        const transaction = db.transaction(() => {
            const info = db.prepare('INSERT INTO users (username, password, role, is_approved) VALUES (?, ?, ?, ?)')
                .run(username, hashedPassword, 'user', 1); // Auto-approve with code

            db.prepare('UPDATE invite_codes SET is_used = 1 WHERE id = ?').run(code.id);
            return info;
        });

        transaction();
        res.status(201).json({ message: 'User created' });
    } catch (error) {
        res.status(400).json({ error: 'Username already exists' });
    }
});

app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);

    if (!user) {
        return res.status(400).json({ error: 'User not found' });
    }

    if (user.is_approved === 0) {
        return res.status(403).json({ error: 'Account pending approval' });
    }

    if (user.is_approved === 2) {
        return res.status(403).json({ error: 'Account blocked' });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
        return res.status(400).json({ error: 'Invalid password' });
    }

    const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
    res.json({ token, role: user.role, max_companies: user.max_companies, allowed_years: user.allowed_years });
});

// Admin Routes
const isAdmin = (req, res, next) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
    next();
};

// Admin: Get Users
app.get('/api/admin/users', authenticateToken, isAdmin, (req, res) => {
    const users = db.prepare('SELECT id, username, role, is_approved, max_companies, allowed_years, created_at FROM users').all();
    res.json(users);
});

// Admin: Update User
app.put('/api/admin/users/:id', authenticateToken, isAdmin, (req, res) => {
    const { is_approved, max_companies, allowed_years } = req.body;
    db.prepare('UPDATE users SET is_approved = ?, max_companies = ?, allowed_years = ? WHERE id = ?')
        .run(is_approved, max_companies, allowed_years, req.params.id);
    res.json({ message: 'User updated' });
});

// Admin: Delete User



// Admin: Delete User
app.delete('/api/admin/users/:id', authenticateToken, isAdmin, (req, res) => {
    const { id } = req.params;
    // Prevent deleting Super Admin 'vishnu'
    const user = db.prepare('SELECT username FROM users WHERE id = ?').get(id);
    if (user && user.username === 'vishnu') {
        return res.status(403).json({ error: 'Cannot delete Super Admin' });
    }

    db.prepare('DELETE FROM users WHERE id = ?').run(id);
    res.json({ message: 'User deleted' });
});

// Admin: Get Codes
app.get('/api/admin/invite-codes', authenticateToken, isAdmin, (req, res) => {
    const codes = db.prepare('SELECT * FROM invite_codes ORDER BY created_at DESC').all();
    res.json(codes);
});

// Admin: Generate/Create Code
app.post('/api/admin/invite-codes', authenticateToken, isAdmin, (req, res) => {
    let { code } = req.body;
    if (!code) {
        code = Math.random().toString(36).substring(2, 8).toUpperCase();
    } else {
        code = code.toUpperCase();
    }

    try {
        db.prepare('INSERT INTO invite_codes (code, created_by) VALUES (?, ?)').run(code, req.user.username);
        res.json({ code });
    } catch (e) {
        res.status(400).json({ error: 'Code already exists' });
    }
});

// Admin: Edit Code
app.put('/api/admin/invite-codes/:id', authenticateToken, isAdmin, (req, res) => {
    const { code } = req.body;
    if (!code) return res.status(400).json({ error: 'Code required' });

    try {
        db.prepare('UPDATE invite_codes SET code = ? WHERE id = ?').run(code.toUpperCase(), req.params.id);
        res.json({ message: 'Code updated' });
    } catch (e) {
        res.status(400).json({ error: 'Code update failed (duplicate?)' });
    }
});

// Company Routes
app.get('/api/companies', authenticateToken, (req, res) => {
    try {
        const stmt = db.prepare('SELECT * FROM companies ORDER BY name ASC');
        const companies = stmt.all();
        res.json(companies);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/companies', authenticateToken, (req, res) => {
    try {
        const { name, address, gst_number } = req.body;
        const stmt = db.prepare('INSERT INTO companies (name, address, gst_number) VALUES (?, ?, ?)');
        const info = stmt.run(name, address, gst_number);
        res.json({ id: info.lastInsertRowid, ...req.body });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/companies/:id', authenticateToken, (req, res) => {
    try {
        const { id } = req.params;
        const { name, address, gst_number } = req.body;
        const stmt = db.prepare('UPDATE companies SET name = ?, address = ?, gst_number = ? WHERE id = ?');
        stmt.run(name, address, gst_number, id);
        res.json({ message: 'Company updated' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/companies/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const adminPassword = req.headers['admin-password'];

        // 1. Strict Role Check
        if (req.user.role !== 'admin' && req.user.username !== 'vishnu') {
            return res.status(403).json({ error: 'Access Denied: Only Admins can delete companies.' });
        }

        // 2. Password Verification
        if (!adminPassword) {
            return res.status(400).json({ error: 'Admin password is required.' });
        }

        const user = db.prepare('SELECT password FROM users WHERE id = ?').get(req.user.id);
        if (!user) return res.status(404).json({ error: 'User not found.' });

        const validPassword = await bcrypt.compare(adminPassword, user.password);
        if (!validPassword) {
            return res.status(403).json({ error: 'Invalid Password. Deletion Aborted.' });
        }

        const transaction = db.transaction(() => {
            // Delete dependent records first to satisfy Foreign Key constraints
            // 1. Tables referencing Products
            db.prepare('DELETE FROM stock_ledger WHERE company_id = ?').run(id);
            // production_items doesn't have company_id directly, but linked via logs. 
            // We can delete via join or just rely on cascade, but explicit is safer if we know the IDs.
            // Actually, we can delete production_logs, which should cascade. 
            // But to be 100% safe against "Foreign key constraint failed" on Products delete:
            // Let's get all production_log ids for this company and delete items.
            const logs = db.prepare('SELECT id FROM production_logs WHERE company_id = ?').all(id);
            const logIds = logs.map(l => l.id);
            if (logIds.length > 0) {
                db.prepare(`DELETE FROM production_items WHERE production_id IN(${logIds.join(',')})`).run();
            }
            db.prepare('DELETE FROM production_logs WHERE company_id = ?').run(id);

            // 2. Tables referencing Parties
            db.prepare('DELETE FROM sales WHERE company_id = ?').run(id);
            db.prepare('DELETE FROM purchases WHERE company_id = ?').run(id);

            // 3. Tables referencing Company only (or now cleared dependencies)
            db.prepare('DELETE FROM products WHERE company_id = ?').run(id);
            db.prepare('DELETE FROM parties WHERE company_id = ?').run(id);

            // Finally delete company
            db.prepare('DELETE FROM companies WHERE id = ?').run(id);
        });

        transaction();
        res.json({ message: 'Company and all associated data deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Party Master Routes (Company Aware)
app.get('/api/parties', authenticateToken, (req, res) => {
    try {
        const companyId = req.headers['company-id'];
        if (!companyId) return res.status(400).json({ error: 'Company ID required' });

        const stmt = db.prepare('SELECT * FROM parties WHERE company_id = ? ORDER BY name ASC');
        const parties = stmt.all(companyId);
        res.json(parties);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/parties', authenticateToken, (req, res) => {
    try {
        const companyId = req.headers['company-id'];
        if (!companyId) return res.status(400).json({ error: 'Company ID required' });

        const { name, gst_number, address, contact } = req.body;
        const stmt = db.prepare('INSERT INTO parties (company_id, name, gst_number, address, contact) VALUES (?, ?, ?, ?, ?)');
        const info = stmt.run(companyId, name, gst_number, address, contact);
        res.json({ id: info.lastInsertRowid, ...req.body });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/parties/bulk', authenticateToken, (req, res) => {
    try {
        const companyId = req.headers['company-id'];
        if (!companyId) return res.status(400).json({ error: 'Company ID required' });

        const parties = req.body;
        const insert = db.prepare('INSERT INTO parties (company_id, name, gst_number) VALUES (?, ?, ?)');
        const insertMany = db.transaction((parties) => {
            let count = 0;
            for (const p of parties) {
                if (p.name) {
                    insert.run(companyId, p.name, p.gst_number || '');
                    count++;
                }
            }
            return count;
        });

        const count = insertMany(parties);
        res.json({ message: `Successfully imported ${count} parties` });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/parties/:id', authenticateToken, (req, res) => {
    try {
        const { id } = req.params;
        const { name, gst_number, address, contact } = req.body;
        const stmt = db.prepare('UPDATE parties SET name = ?, gst_number = ?, address = ?, contact = ? WHERE id = ?');
        stmt.run(name, gst_number, address, contact, id);
        res.json({ message: 'Party updated successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/parties/:id', authenticateToken, (req, res) => {
    try {
        const { id } = req.params;
        const stmt = db.prepare('DELETE FROM parties WHERE id = ?');
        stmt.run(id);
        res.json({ message: 'Party deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Sales Routes (Company & FY Aware)
app.get('/api/sales', authenticateToken, (req, res) => {
    try {
        const companyId = req.headers['company-id'];
        const financialYear = req.headers['financial-year'];
        if (!companyId) return res.status(400).json({ error: 'Company ID required' });

        const { month, year, hsn, party } = req.query;
        let query = `
      SELECT s.*, p.name as party_name, p.gst_number, pr.name as product_name, pr.packing_type as product_unit
      FROM sales s 
      LEFT JOIN parties p ON s.party_id = p.id
      LEFT JOIN products pr ON s.product_id = pr.id
      WHERE s.company_id = ?
    `;
        const params = [companyId];

        // Filter by Financial Year if provided, else rely on manual filters
        if (financialYear && financialYear !== 'all') {
            query += ` AND s.financial_year = ? `;
            params.push(financialYear);
        }

        if (month && year && month !== 'all' && year !== 'all') {
            query += ` AND strftime('%m', s.date) = ? AND strftime('%Y', s.date) = ? `;
            params.push(month.toString().padStart(2, '0'), year.toString());
        } else if (year && year !== 'all') {
            query += ` AND strftime('%Y', s.date) = ? `;
            params.push(year.toString());
        }

        if (hsn) {
            query += ` AND s.hsn_code = ? `;
            params.push(hsn);
        }

        if (party) {
            query += ` AND p.name LIKE ? `;
            params.push(`% ${party}% `);
        }

        // Sort by Date then Bill Number (Numerically)
        query += ` ORDER BY s.date ASC, CAST(s.bill_no AS INTEGER) ASC`;

        const stmt = db.prepare(query);
        const sales = stmt.all(...params);
        res.json(sales);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/sales', authenticateToken, (req, res) => {
    try {
        const companyId = req.headers['company-id'];
        const financialYear = req.headers['financial-year'];
        if (!companyId) return res.status(400).json({ error: 'Company ID required' });

        const { date, bill_no, party_id, bill_value, bags, unit, conversion_factor, hsn_code, tax_rate, cgst, sgst, total, product_id } = req.body;

        const transaction = db.transaction(() => {
            // 1. Insert Sale Record
            const stmt = db.prepare(`
                INSERT INTO sales(company_id, financial_year, date, bill_no, party_id, bill_value, bags, unit, conversion_factor, hsn_code, tax_rate, cgst, sgst, total, product_id)
VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
            const info = stmt.run(companyId, financialYear, date, bill_no, party_id, bill_value, bags, unit, conversion_factor || 1.0, hsn_code, tax_rate, cgst, sgst, total, product_id || null);
            const saleId = info.lastInsertRowid;

            // 2. Reduce Stock (Sale Out)
            // Only if product_id is provided
            if (product_id) {
                // Determine quantity (bags is the input quantity)
                const quantity = bags || 0;
                // Apply Conversion Factor for Stock Ledger (Base Unit)
                const stockQty = quantity * (conversion_factor || 1.0);

                // Verify Unit Conversion? - Basic MVP assumes 'bags' is the base unit count.

                // Insert Stock Ledger for SALE
                db.prepare(`
                    INSERT INTO stock_ledger(company_id, date, product_id, transaction_type, related_id, quantity_out, quantity_in)
VALUES(?, ?, ?, 'SALE', ?, ?, 0)
    `).run(companyId, date, product_id, saleId, stockQty);

                // 3. Auto-Production (Smart Logic: Only produce what is missing)
                // Check for Formula
                // Fetch Formula AND Ingredient Details (to check units)
                const formula = db.prepare(`
                    SELECT pf.*, p.packing_type as ingredient_unit, p.secondary_unit, p.conversion_rate, p.has_dual_units
                    FROM product_formulas pf
                    LEFT JOIN products p ON pf.ingredient_id = p.id
                    WHERE pf.product_id = ?
    `).all(product_id);

                if (formula.length > 0) {
                    // Check Current Stock Level
                    const stockRes = db.prepare(`
                        SELECT COALESCE(SUM(quantity_in) - SUM(quantity_out), 0) as balance 
                        FROM stock_ledger 
                        WHERE company_id = ? AND product_id = ?
    `).get(companyId, product_id);

                    const currentStock = stockRes ? stockRes.balance : 0;

                    // Logic Fix:
                    // currentStock is the Balance (Opening + In - Out)
                    // Since we ALREADY inserted the Sale above, currentStock INCLUDES the sale.
                    // If we had 10, sold 15. currentStock is -5.
                    // Deficit is simply the absolute value of currentStock if it's negative.
                    // (deficit = 0 if currentStock >= 0)

                    const deficit = currentStock < 0 ? Math.abs(currentStock) : 0;

                    if (deficit > 0) {
                        // Batch Size Logic:
                        // Fetch the product's configured Formula Base Quantity (Batch Size)
                        const prodInfo = db.prepare('SELECT formula_base_qty FROM products WHERE id = ?').get(product_id);
                        const batchSize = (prodInfo && prodInfo.formula_base_qty) ? prodInfo.formula_base_qty : 1;

                        // Enforce Integer Production (unless unit is KG)
                        // Normalize unit: user input might be mixed case
                        const unitType = unit ? unit.toUpperCase().trim() : '';
                        const isDecimalAllowed = unitType === 'KG' || unitType === 'KGS' || unitType === 'KILOGRAM';

                        let rawProductionQty = isDecimalAllowed ? deficit : Math.ceil(deficit);

                        // Round UP to nearest multiple of Batch Size
                        // e.g. Deficit 15, Batch 10 -> Produce 20
                        const productionQty = Math.ceil(rawProductionQty / batchSize) * batchSize;

                        // Insert PRODUCTION Entry (IN for Finished Good)
                        // This acts as a "Receipt" for the manufactured goods
                        db.prepare(`
                            INSERT INTO stock_ledger(company_id, date, product_id, transaction_type, related_id, quantity_in, quantity_out)
VALUES(?, ?, ?, 'PRODUCTION', ?, ?, 0)
    `).run(companyId, date, product_id, saleId, productionQty);

                        // Insert CONSUMPTION Entries (OUT for Ingredients)
                        for (const item of formula) {
                            let quantityPerUnit = item.quantity; // Default to configured qty
                            let transUnit = item.ingredient_unit; // Default to Primary
                            let transConv = 1.0;

                            // Handle Dual Unit Preference (Secondary vs Primary)
                            if (item.unit_type === 'secondary' && item.conversion_rate) {
                                const pUnit = (item.ingredient_unit || '').toUpperCase();
                                const sUnit = (item.secondary_unit || '').toUpperCase();

                                const smallUnits = ['KG', 'KGS', 'KILOGRAM', 'GM', 'GRAM', 'GMS', 'LTR', 'LITER', 'ML', 'METER', 'MTR', 'NOS', 'PCS', 'PIECE'];
                                const largeUnits = ['BAG', 'BOX', 'PACK', 'PKT', 'DRUM', 'CAN', 'BOTTLE', 'JAR', 'TIN', 'BUNDLE', 'ROLL', 'CRT', 'CARTON'];

                                const isSecSmall = smallUnits.some(u => sUnit.includes(u));
                                const isPrimLarge = largeUnits.some(u => pUnit.includes(u));

                                if (isSecSmall && isPrimLarge) {
                                    // Sec (Small) -> Base (Large) : DIVIDE
                                    console.log(`[DEBUG] DIVIDE Logic: ${item.quantity} / ${item.conversion_rate}`);
                                    quantityPerUnit = item.quantity / item.conversion_rate;
                                } else if (smallUnits.some(u => pUnit.includes(u)) && largeUnits.some(u => sUnit.includes(u))) {
                                    // Base (Small) -> Sec (Large) : MULTIPLY (Rare)
                                    console.log(`[DEBUG] MULTIPLY Logic (Rare): ${item.quantity} * ${item.conversion_rate}`);
                                    quantityPerUnit = item.quantity * item.conversion_rate;
                                } else {
                                    // Fallback: If Rate > 1 and Secondary, assume Sec is smaller (Divide) for safety with KGS/BAGS
                                    if (item.conversion_rate > 1) {
                                        console.log(`[DEBUG] FALLBACK DIVIDE (Rate > 1): ${item.quantity} / ${item.conversion_rate}`);
                                        quantityPerUnit = item.quantity / item.conversion_rate;
                                    } else {
                                        console.log(`[DEBUG] FALLBACK MULTIPLY: ${item.quantity} * ${item.conversion_rate}`);
                                        quantityPerUnit = item.quantity * item.conversion_rate;
                                    }
                                }

                                transUnit = item.secondary_unit; // Record that we used Secondary
                                transConv = item.conversion_rate;
                            }

                            let requiredQty = productionQty * quantityPerUnit;

                            // Check Ingredient Unit for Integer Enforcement
                            const unitType = item.ingredient_unit ? item.ingredient_unit.toUpperCase().trim() : '';
                            // Allow decimals if unit is typically decimal OR if the product supports Dual Units (e.g. Bags splitting into Kgs)
                            const isDecimalAllowed = ['KG', 'KGS', 'KILOGRAM', 'LTR', 'LITER', 'GM', 'GRAM'].some(u => unitType.includes(u)) || !!item.has_dual_units;

                            if (!isDecimalAllowed) {
                                requiredQty = Math.ceil(requiredQty);
                            }

                            db.prepare(`
                                INSERT INTO stock_ledger (company_id, date, product_id, transaction_type, related_id, quantity_out, quantity_in, trans_unit, trans_conversion_factor)
                                VALUES (?, ?, ?, 'CONSUMPTION', ?, ?, 0, ?, ?)
                            `).run(companyId, date, item.ingredient_id, saleId, requiredQty, transUnit, transConv);
                        }
                    }
                }
            }

            return saleId;
        });

        const saleId = transaction();
        res.json({ id: saleId, ...req.body });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/sales/:id', authenticateToken, (req, res) => {
    try {
        const { id } = req.params;

        const transaction = db.transaction(() => {
            // 1. Delete associated Stock Ledger entries (Sale, Production, Consumption)
            // 'related_id' links to sales.id for these transaction types
            db.prepare(`
                DELETE FROM stock_ledger 
                WHERE related_id = ? 
                AND transaction_type IN ('SALE', 'PRODUCTION', 'CONSUMPTION')
            `).run(id);

            // 2. Delete the Sale Record
            const stmt = db.prepare('DELETE FROM sales WHERE id = ?');
            stmt.run(id);
        });

        transaction();
        res.json({ message: 'Sale and associated stock entries deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/sales/:id', authenticateToken, (req, res) => {
    try {
        const { id } = req.params;
        const { date, bill_no, party_id, bill_value, bags, unit, conversion_factor, hsn_code, tax_rate, cgst, sgst, total, product_id } = req.body;

        const transaction = db.transaction(() => {
            const stmt = db.prepare(`
                UPDATE sales 
                SET date = ?, bill_no = ?, party_id = ?, bill_value = ?, bags = ?, unit = ?, conversion_factor = ?, hsn_code = ?, tax_rate = ?, cgst = ?, sgst = ?, total = ?, product_id = ?
                WHERE id = ?
            `);
            stmt.run(date, bill_no, party_id, bill_value, bags, unit, conversion_factor || 1.0, hsn_code, tax_rate, cgst, sgst, total, product_id || null, id);

            // Update or Insert Stock Ledger if product_id exists
            if (product_id) {
                const quantity = bags || 0;
                // Assuming simple quantity for now, or use conversion factor calculated above?
                // The Update logic used 'stockQty = quantity * (conversion_factor || 1.0)'.
                // Let's match that.

                const stockQty = quantity * (conversion_factor || 1.0);

                const result = db.prepare(`
                    UPDATE stock_ledger 
                    SET date = ?, product_id = ?, quantity_out = ?
                    WHERE related_id = ? AND transaction_type = 'SALE'
                `).run(date, product_id, stockQty, id);

                if (result.changes === 0) {
                    // Entry missing, Insert it
                    db.prepare(`
                        INSERT INTO stock_ledger (company_id, date, product_id, transaction_type, related_id, quantity_out, quantity_in)
                        VALUES ((SELECT company_id FROM sales WHERE id = ?), ?, ?, 'SALE', ?, ?, 0)
                    `).run(id, date, product_id, id, stockQty);
                }

            }

            // 4. Auto-Production Check on Edit (Repair Missing)
            // If Production entry is missing, try to generate it (using same logic as POST)
            if (product_id) {
                const prodExists = db.prepare(`SELECT id FROM stock_ledger WHERE related_id = ? AND transaction_type = 'PRODUCTION'`).get(id);
                if (!prodExists) {
                    // COPIED LOGIC from POST (Refactor recommended in future)
                    const formula = db.prepare(`
                        SELECT pf.*, p.packing_type as ingredient_unit, p.secondary_unit, p.conversion_rate, p.has_dual_units
                        FROM product_formulas pf
                        JOIN products p ON pf.ingredient_id = p.id
                        WHERE pf.product_id = ?
                    `).all(product_id);

                    if (formula.length > 0) {
                        const stockRes = db.prepare(`
                            SELECT COALESCE(SUM(quantity_in) - SUM(quantity_out), 0) as balance 
                            FROM stock_ledger 
                            WHERE company_id = ? AND product_id = ?
                        `).get(req.headers['company-id'] || 1, product_id);

                        const currentStock = stockRes ? stockRes.balance : 0;
                        const deficit = currentStock < 0 ? Math.abs(currentStock) : 0;

                        if (deficit > 0) {
                            // Batch Size Logic (Copied from POST)
                            const prodInfo = db.prepare('SELECT formula_base_qty FROM products WHERE id = ?').get(product_id);
                            const batchSize = (prodInfo && prodInfo.formula_base_qty) ? prodInfo.formula_base_qty : 1;

                            const unitType = unit ? unit.toUpperCase().trim() : '';
                            const isDecimalAllowed = ['KG', 'KGS', 'KILOGRAM', 'LTR', 'LITER', 'GM', 'GRAM'].some(u => unitType.includes(u));
                            let rawProductionQty = isDecimalAllowed ? deficit : Math.ceil(deficit);
                            const productionQty = Math.ceil(rawProductionQty / batchSize) * batchSize;

                            db.prepare(`
                                INSERT INTO stock_ledger (company_id, date, product_id, transaction_type, related_id, quantity_in, quantity_out)
                                VALUES ((SELECT company_id FROM sales WHERE id = ?), ?, ?, 'PRODUCTION', ?, ?, 0)
                             `).run(id, date, product_id, id, productionQty);

                            for (const item of formula) {
                                let quantityPerUnit = item.quantity;
                                let transUnit = item.ingredient_unit;
                                let transConv = 1.0;

                                if (item.unit_type === 'secondary' && item.conversion_rate) {
                                    // Smart Conversion Logic (Inverse Support)
                                    const secUnit = item.secondary_unit ? item.secondary_unit.toUpperCase() : '';
                                    const primUnit = item.ingredient_unit ? item.ingredient_unit.toUpperCase() : '';
                                    const rate = parseFloat(item.conversion_rate);

                                    const smallUnits = ['KG', 'KGS', 'KILOGRAM', 'GM', 'GRAM', 'GMS', 'LTR', 'LITER', 'ML', 'METER', 'MTR', 'NOS', 'PCS', 'PIECE'];
                                    const largeUnits = ['BAG', 'BOX', 'PACK', 'PKT', 'DRUM', 'CAN', 'BOTTLE', 'JAR', 'TIN', 'BUNDLE', 'ROLL', 'CRT', 'CARTON'];

                                    const isSecSmall = smallUnits.some(u => secUnit.includes(u));
                                    const isPrimLarge = largeUnits.some(u => primUnit.includes(u));

                                    if (isSecSmall && isPrimLarge && rate > 1) {
                                        quantityPerUnit = item.quantity / rate;
                                    } else {
                                        quantityPerUnit = item.quantity * rate;
                                    }

                                    transUnit = item.secondary_unit;
                                    transConv = item.conversion_rate;
                                }

                                let requiredQty = productionQty * quantityPerUnit;
                                const iUnit = item.ingredient_unit ? item.ingredient_unit.toUpperCase().trim() : '';
                                const isIngDecimal = ['KG', 'KGS', 'KILOGRAM', 'LTR', 'LITER', 'GM', 'GRAM'].some(u => iUnit.includes(u)) || !!item.has_dual_units;

                                if (!isIngDecimal) {
                                    requiredQty = Math.ceil(requiredQty);
                                }

                                db.prepare(`
                                    INSERT INTO stock_ledger (company_id, date, product_id, transaction_type, related_id, quantity_out, quantity_in, trans_unit, trans_conversion_factor)
                                    VALUES ((SELECT company_id FROM sales WHERE id = ?), ?, ?, 'CONSUMPTION', ?, ?, 0, ?, ?)
                                `).run(id, date, item.ingredient_id, id, requiredQty, transUnit, transConv);
                            }
                        }
                    }
                }
            }
        });
        transaction();
        res.json({ message: 'Sale updated successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Purchase Routes
app.get('/api/purchases', authenticateToken, (req, res) => {
    try {
        const companyId = req.headers['company-id'];
        const financialYear = req.headers['financial-year'];
        if (!companyId) return res.status(400).json({ error: 'Company ID required' });

        const { month, year, hsn, party } = req.query;
        let query = `
      SELECT p.*, pt.name as party_name 
      FROM purchases p 
      LEFT JOIN parties pt ON p.party_id = pt.id
      WHERE p.company_id = ?
    `;
        const params = [companyId];

        if (financialYear && financialYear !== 'all') {
            query += ` AND p.financial_year = ?`;
            params.push(financialYear);
        }

        if (month && year && month !== 'all' && year !== 'all') {
            query += ` AND strftime('%m', p.date) = ? AND strftime('%Y', p.date) = ?`;
            params.push(month.toString().padStart(2, '0'), year.toString());
        } else if (year && year !== 'all') {
            query += ` AND strftime('%Y', p.date) = ?`;
            params.push(year.toString());
        }

        if (hsn) {
            query += ` AND p.hsn_code = ?`;
            params.push(hsn);
        }

        if (party) {
            query += ` AND pt.name LIKE ?`;
            params.push(`%${party}%`);
        }

        query += ` ORDER BY p.date ASC`;

        const stmt = db.prepare(query);
        const purchases = stmt.all(...params);
        res.json(purchases);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/purchases', authenticateToken, (req, res) => {
    try {
        const companyId = req.headers['company-id'];
        const financialYear = req.headers['financial-year'];
        if (!companyId) return res.status(400).json({ error: 'Company ID required' });

        const {
            date, bill_no, received_date, party_id, gst_number, hsn_code, quantity, unit, conversion_factor,
            taxable_value, tax_rate, cgst, sgst, bill_value,
            freight_charges, loading_charges, unloading_charges, auto_charges, expenses_total, rcm_tax_payable, product_id, round_off
        } = req.body;

        const transaction = db.transaction(() => {
            const stmt = db.prepare(`
                INSERT INTO purchases (
                    company_id, financial_year, date, bill_no, received_date, party_id, gst_number, hsn_code, 
                    quantity, unit, conversion_factor, taxable_value, tax_rate, cgst, sgst, bill_value,
                    freight_charges, loading_charges, unloading_charges, auto_charges, expenses_total, rcm_tax_payable, product_id, round_off
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);

            const info = stmt.run(
                companyId, financialYear, date, bill_no, received_date, party_id, gst_number, hsn_code,
                quantity, unit, conversion_factor || 1.0, taxable_value, tax_rate, cgst, sgst, bill_value,
                freight_charges || 0, loading_charges || 0, unloading_charges || 0, auto_charges || 0, expenses_total || 0, rcm_tax_payable || 0, product_id || null, round_off || 0
            );
            const purchaseId = info.lastInsertRowid;

            // Update Stock Ledger (PURCHASE IN)
            if (product_id) {
                const qty = quantity || 0;
                // Calculate Base Qty
                let stockQty = qty;
                if (conversion_factor && conversion_factor > 1) {
                    stockQty = qty * conversion_factor;
                }

                db.prepare(`
                    INSERT INTO stock_ledger (company_id, date, product_id, transaction_type, related_id, quantity_in, quantity_out, trans_unit, trans_conversion_factor)
                    VALUES (?, ?, ?, 'PURCHASE', ?, ?, 0, ?, ?)
                `).run(companyId, date, product_id, purchaseId, stockQty, unit || '', conversion_factor || 1.0);
            }
            return purchaseId;
        });

        const purchaseId = transaction();
        res.json({ id: purchaseId, ...req.body });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/purchases/:id', authenticateToken, (req, res) => {
    try {
        const { id } = req.params;
        const {
            date, bill_no, received_date, party_id, gst_number, hsn_code, quantity, unit, conversion_factor,
            taxable_value, tax_rate, cgst, sgst, bill_value,
            freight_charges, loading_charges, unloading_charges, auto_charges, expenses_total, rcm_tax_payable, product_id, round_off
        } = req.body;

        const transaction = db.transaction(() => {
            const stmt = db.prepare(`
                UPDATE purchases 
                SET date = ?, bill_no = ?, received_date = ?, party_id = ?, gst_number = ?, hsn_code = ?, 
                    quantity = ?, unit = ?, conversion_factor = ?, taxable_value = ?, tax_rate = ?, cgst = ?, sgst = ?, bill_value = ?,
                    freight_charges = ?, loading_charges = ?, unloading_charges = ?, auto_charges = ?, expenses_total = ?, rcm_tax_payable = ?, product_id = ?, round_off = ?
                WHERE id = ?
            `);

            stmt.run(
                date, bill_no, received_date, party_id, gst_number, hsn_code,
                quantity, unit, conversion_factor || 1.0, taxable_value, tax_rate, cgst, sgst, bill_value,
                freight_charges || 0, loading_charges || 0, unloading_charges || 0, auto_charges || 0, expenses_total || 0, rcm_tax_payable || 0, product_id || null, round_off || 0,
                id
            );

            // Update Stock Ledger (PURCHASE IN)
            if (product_id) {
                const qty = quantity || 0;
                let stockQty = qty;
                if (conversion_factor && conversion_factor > 1) {
                    stockQty = qty * conversion_factor;
                }

                db.prepare(`
                    UPDATE stock_ledger
                    SET date = ?, product_id = ?, quantity_in = ?, trans_unit = ?, trans_conversion_factor = ?
                    WHERE related_id = ? AND transaction_type = 'PURCHASE'
                `).run(date, product_id, stockQty, unit || '', conversion_factor || 1.0, id);
            }
        });
        transaction();

        res.json({ message: 'Purchase updated successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/purchases/:id', authenticateToken, (req, res) => {
    try {
        const { id } = req.params;

        const transaction = db.transaction(() => {
            // 1. Delete associated Stock Ledger entries (Purchase)
            db.prepare(`
                DELETE FROM stock_ledger 
                WHERE related_id = ? 
                AND transaction_type = 'PURCHASE'
            `).run(id);

            // 2. Delete the Purchase Record
            const stmt = db.prepare('DELETE FROM purchases WHERE id = ?');
            stmt.run(id);
        });

        transaction();
        res.json({ message: 'Purchase and associated stock entries deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});


// Dashboard Stats (Company Aware)
app.get('/api/dashboard', authenticateToken, (req, res) => {
    try {
        const companyId = req.headers['company-id'];
        const financialYear = req.headers['financial-year'];
        if (!companyId) return res.status(400).json({ error: 'Company ID required' });

        const whereSql = `WHERE company_id = ? AND financial_year = ?`;

        const totalSales = db.prepare(`SELECT SUM(total) as total FROM sales ${whereSql}`).get(companyId, financialYear).total || 0;
        const totalGST = db.prepare(`SELECT SUM(cgst + sgst) as total FROM sales ${whereSql}`).get(companyId, financialYear).total || 0;
        const totalBags = db.prepare(`SELECT SUM(bags) as total FROM sales ${whereSql}`).get(companyId, financialYear).total || 0;
        const totalBills = db.prepare(`SELECT COUNT(*) as total FROM sales ${whereSql}`).get(companyId, financialYear).total || 0;
        const lastBillNo = db.prepare(`SELECT MAX(CAST(bill_no AS INTEGER)) as max_bill FROM sales ${whereSql}`).get(companyId, financialYear).max_bill || 0;

        res.json({
            totalSales,
            totalGST,
            totalBags,
            totalBills,
            lastBillNo
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get Next Bill Number (Company & FY Aware)
app.get('/api/sales/next-bill-no', authenticateToken, (req, res) => {
    try {
        const companyId = req.headers['company-id'];
        const financialYear = req.headers['financial-year'];
        if (!companyId) return res.status(400).json({ error: 'Company ID required' });

        const result = db.prepare(`
            SELECT MAX(CAST(bill_no AS INTEGER)) as max_bill 
            FROM sales 
            WHERE company_id = ? AND financial_year = ?
        `).get(companyId, financialYear);

        const maxBill = result.max_bill || 0;
        const nextBill = maxBill + 1;
        res.json({ next_bill_no: nextBill, last_bill_no: maxBill });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});



// Stock Adjustment & Transfer Route
app.post('/api/stock/adjust', authenticateToken, (req, res) => {
    try {
        const companyId = req.headers['company-id'];
        if (!companyId) return res.status(400).json({ error: 'Company ID required' });

        const { date, product_id, type, quantity, remarks, related_product_id, unit_mode, conversion_factor, unit_name } = req.body;
        // type: 'ADJUSTMENT_IN', 'ADJUSTMENT_OUT', 'TRANSFER'

        const transaction = db.transaction(() => {
            let inputQty = parseFloat(quantity);
            if (isNaN(inputQty) || inputQty <= 0) throw new Error('Invalid quantity');

            // Handle Secondary Unit Conversion
            let baseQty = inputQty;
            let transUnit = unit_name || '';
            let transConv = parseFloat(conversion_factor) || 1.0;

            if (unit_mode === 'secondary' && transConv > 1) {
                // Determine conversion direction based on unit names if possible?
                // We typically need to know if Base is larger or smaller.
                // Fetch product details efficiently? Or pass flags from frontend?
                // For now, let's use the Heuristic, but better to query Product.

                // Fetch product to know Primary/Secondary units
                const prod = db.prepare('SELECT packing_type, secondary_unit FROM products WHERE id = ?').get(product_id);
                if (prod) {
                    const pUnit = (prod.packing_type || '').toUpperCase();
                    const sUnit = (prod.secondary_unit || '').toUpperCase();

                    const smallUnits = ['KG', 'KGS', 'KILOGRAM', 'GM', 'GRAM', 'GMS', 'LTR', 'LITER', 'ML', 'METER', 'MTR', 'NOS', 'PCS', 'PIECE'];
                    const largeUnits = ['BAG', 'BOX', 'PACK', 'PKT', 'DRUM', 'CAN', 'BOTTLE', 'JAR', 'TIN', 'BUNDLE', 'ROLL', 'CRT', 'CARTON'];

                    const isSecSmall = smallUnits.some(u => sUnit.includes(u));
                    const isPrimLarge = largeUnits.some(u => pUnit.includes(u));

                    if (isSecSmall && isPrimLarge) {
                        // Secondary (Small e.g. Kg) to Primary (Large e.g. Bag)
                        // We are converting Input (Sec) to Base (Prim).
                        // 100 Kg / 20 = 5 Bags.
                        baseQty = inputQty / transConv;
                    } else {
                        // Fallback or Inverse: 1 Bag (Sec) -> 20 Kg (Prim).
                        // 1 Bag (Input) * 20 = 20 Kg (Base).
                        baseQty = inputQty * transConv;
                    }
                } else {
                    // Fallback if product not found (shouldn't happen)
                    baseQty = inputQty * transConv;
                }
            }

            if (type === 'TRANSFER') {
                if (!related_product_id) throw new Error('Source product required for transfer');

                // 1. Deduct from Source (related_product_id)
                db.prepare(`
                    INSERT INTO stock_ledger (company_id, date, product_id, transaction_type, quantity_out, quantity_in, batch_id, trans_unit, trans_conversion_factor)
                    VALUES (?, ?, ?, 'TRANSFER_OUT', ?, 0, ?, ?, ?)
                `).run(companyId, date, related_product_id, baseQty, remarks, transUnit, transConv);

                // 2. Add to Target (product_id)
                db.prepare(`
                    INSERT INTO stock_ledger (company_id, date, product_id, transaction_type, quantity_in, quantity_out, batch_id, trans_unit, trans_conversion_factor)
                    VALUES (?, ?, ?, 'TRANSFER_IN', ?, 0, ?, ?, ?)
                `).run(companyId, date, product_id, baseQty, remarks, transUnit || '', transConv || 1.0); // Assuming Transfer Target always accepts base? Or same unit?
                // Transfer implies shifting stock. If Source/Target are different products, units might differ.
                // But usually Transfer is location based or same product.
                // If products differ (e.g. conversion), keeping same unit metadata is fine.

            } else {
                // Simple Adjustment
                const isIn = type === 'ADJUSTMENT_IN';
                db.prepare(`
                    INSERT INTO stock_ledger (company_id, date, product_id, transaction_type, quantity_in, quantity_out, batch_id, trans_unit, trans_conversion_factor)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                `).run(
                    companyId,
                    date,
                    product_id,
                    type,
                    isIn ? baseQty : 0,
                    isIn ? 0 : baseQty,
                    remarks,
                    transUnit,
                    transConv
                );
            }
        });

        transaction();
        res.json({ message: 'Stock adjusted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Products Routes
app.get('/api/products', authenticateToken, (req, res) => {
    try {
        const companyId = req.headers['company-id'];
        const financialYear = req.headers['financial-year'];
        if (!companyId) return res.status(400).json({ error: 'Company ID required' });

        let startDate = '1970-01-01';
        let endDate = '2099-12-31';

        if (financialYear) {
            const parts = financialYear.split('-');
            if (parts.length === 2) {
                startDate = `${parts[0]}-04-01`;
                endDate = `${parts[1]}-03-31`;
            }
        }

        // Include current_stock calculation AND opening_stock SCOPED to Financial Year
        const products = db.prepare(`
            SELECT p.*, 
            COALESCE((SELECT SUM(sl.quantity_in) - SUM(sl.quantity_out) FROM stock_ledger sl WHERE sl.product_id = p.id AND sl.date >= ? AND sl.date <= ?), 0) as current_stock,
            COALESCE((SELECT quantity_in FROM stock_ledger sl WHERE sl.product_id = p.id AND sl.transaction_type = 'OPENING' AND sl.date >= ? AND sl.date <= ? LIMIT 1), 0) as opening_stock
            FROM products p WHERE p.company_id = ? ORDER BY p.name ASC
        `).all(startDate, endDate, startDate, endDate, companyId);
        res.json(products);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/products', authenticateToken, (req, res) => {
    try {
        const companyId = req.headers['company-id'];
        const financialYear = req.headers['financial-year']; // e.g., "2024-2025"
        if (!companyId) return res.status(400).json({ error: 'Company ID required' });

        const { name, hsn_code, tax_rate, packing_type, opening_stock, maintain_stock, has_dual_units, secondary_unit, conversion_rate } = req.body;

        const transaction = db.transaction(() => {
            const mStock = maintain_stock ? 1 : 0;
            const dUnits = has_dual_units ? 1 : 0;
            const convRate = conversion_rate ? parseFloat(conversion_rate) : 1.0;

            const stmt = db.prepare('INSERT INTO products (company_id, name, hsn_code, tax_rate, packing_type, maintain_stock, has_dual_units, secondary_unit, conversion_rate) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
            const info = stmt.run(companyId, name, hsn_code, tax_rate, packing_type || 'BAG', mStock, dUnits, secondary_unit, convRate);
            const productId = info.lastInsertRowid;

            // Handle Opening Stock (ONLY if Maintain Stock is Enabled)
            if (mStock === 1 && opening_stock && parseFloat(opening_stock) > 0) {
                // Determine Opening Date: 1st April of the start year
                // Format: "YYYY-YYYY" -> Split -> Take first -> "YYYY-04-01"
                let openingDate = new Date().toISOString().split('T')[0]; // Default fallback
                if (financialYear) {
                    const parts = financialYear.split('-');
                    if (parts.length >= 1) {
                        openingDate = `${parts[0]}-04-01`;
                    }
                }

                const stockStmt = db.prepare(`
                    INSERT INTO stock_ledger (company_id, date, product_id, transaction_type, quantity_in, quantity_out, related_id, trans_unit, trans_conversion_factor)
                    VALUES (?, ?, ?, 'OPENING', ?, 0, NULL, ?, ?)
                `);

                let baseQty = parseFloat(opening_stock);
                let transUnit = packing_type || 'BAG';
                let transConv = 1.0;

                // Secondary Unit Logic for Opening Stock
                if (req.body.opening_unit_mode === 'secondary' && has_dual_units && conversion_rate) {
                    const sec = secondary_unit ? secondary_unit.toUpperCase() : '';
                    const prim = packing_type ? packing_type.toUpperCase() : '';
                    const rate = parseFloat(conversion_rate);

                    // Smart Conv Logic
                    const smallUnits = ['KG', 'KGS', 'KILOGRAM', 'GM', 'GRAM', 'GMS', 'LTR', 'LITER', 'ML', 'METER', 'MTR', 'NOS', 'PCS', 'PIECE'];
                    const largeUnits = ['BAG', 'BOX', 'PACK', 'PKT', 'DRUM', 'CAN', 'BOTTLE', 'JAR', 'TIN', 'BUNDLE', 'ROLL', 'CRT', 'CARTON'];
                    const isSecSmall = smallUnits.some(u => sec.includes(u));
                    const isPrimLarge = largeUnits.some(u => prim.includes(u));

                    if (isSecSmall && isPrimLarge && rate > 1) {
                        baseQty = parseFloat(opening_stock) / rate;
                    } else {
                        baseQty = parseFloat(opening_stock) * rate;
                    }
                    transUnit = secondary_unit;
                    transConv = rate;
                }

                stockStmt.run(companyId, openingDate, productId, baseQty, transUnit, transConv);
            }
            return productId;
        });

        const id = transaction();
        res.json({ id });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});


app.put('/api/products/:id', authenticateToken, (req, res) => {
    try {
        const { id } = req.params;
        // const companyId = req.headers['company-id']; // Need for Ledger Check
        const financialYear = req.headers['financial-year'];
        const { name, hsn_code, tax_rate, packing_type, maintain_stock, has_dual_units, secondary_unit, conversion_rate, opening_stock } = req.body;

        const mStock = maintain_stock ? 1 : 0;
        const dUnits = has_dual_units ? 1 : 0;
        const convRate = conversion_rate ? parseFloat(conversion_rate) : 1.0;

        const transaction = db.transaction(() => {
            const stmt = db.prepare('UPDATE products SET name = ?, hsn_code = ?, tax_rate = ?, packing_type = ?, maintain_stock = ?, has_dual_units = ?, secondary_unit = ?, conversion_rate = ? WHERE id = ?');
            stmt.run(name, hsn_code, tax_rate, packing_type || 'BAG', mStock, dUnits, secondary_unit, convRate, id);

            // Handle Opening Stock Update
            if (mStock === 1) {
                const newOpening = parseFloat(opening_stock) || 0;

                // Determine Opening Date
                let openingDate = new Date().toISOString().split('T')[0];
                if (financialYear) {
                    const parts = financialYear.split('-');
                    if (parts.length >= 1) {
                        openingDate = `${parts[0]}-04-01`;
                    }
                }

                // Calculate Base Qty for Opening Stock (Smart Logic)
                let baseQty = newOpening;
                let transUnit = packing_type || 'BAG';
                let transConv = 1.0;

                if (req.body.opening_unit_mode === 'secondary' && dUnits === 1 && convRate) {
                    const sec = secondary_unit ? secondary_unit.toUpperCase() : '';
                    const prim = packing_type ? packing_type.toUpperCase() : '';

                    const smallUnits = ['KG', 'KGS', 'KILOGRAM', 'GM', 'GRAM', 'GMS', 'LTR', 'LITER', 'ML', 'METER', 'MTR', 'NOS', 'PCS', 'PIECE'];
                    const largeUnits = ['BAG', 'BOX', 'PACK', 'PKT', 'DRUM', 'CAN', 'BOTTLE', 'JAR', 'TIN', 'BUNDLE', 'ROLL', 'CRT', 'CARTON'];
                    const isSecSmall = smallUnits.some(u => sec.includes(u));
                    const isPrimLarge = largeUnits.some(u => prim.includes(u));

                    if (isSecSmall && isPrimLarge && convRate > 1) {
                        baseQty = newOpening / convRate;
                    } else {
                        baseQty = newOpening * convRate;
                    }
                    transUnit = secondary_unit;
                    transConv = convRate;
                }


                // Check for existing OPENING entry
                const existing = db.prepare("SELECT id FROM stock_ledger WHERE product_id = ? AND transaction_type = 'OPENING'").get(id);

                if (existing) {
                    // Update existing, maintaining trans unit info
                    db.prepare("UPDATE stock_ledger SET quantity_in = ?, date = ?, trans_unit = ?, trans_conversion_factor = ? WHERE id = ?").run(baseQty, openingDate, transUnit, transConv, existing.id);
                } else if (newOpening > 0) {
                    // Insert new
                    db.prepare(`
                        INSERT INTO stock_ledger (company_id, date, product_id, transaction_type, quantity_in, quantity_out)
                        VALUES ((SELECT company_id FROM products WHERE id = ?), ?, ?, 'OPENING', ?, 0)
                    `).run(id, openingDate, id, newOpening);
                }
            }
        });

        transaction();
        res.json({ message: 'Product updated' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ... (Delete HSN, GET/POST HSN same as before) ...

// ... (Sales/Purchase Routes) ...

// ... (Dashboard Routes) ...

// ... (Stock Adjustment) ...

// Get Detailed Stock Ledger


app.delete('/api/products/:id', authenticateToken, (req, res) => {
    try {
        const { id } = req.params;
        const stmt = db.prepare('DELETE FROM products WHERE id = ?');
        stmt.run(id);
        res.json({ message: 'Product deleted' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// HSN Code Routes
app.get('/api/hsn', authenticateToken, (req, res) => {
    try {
        const companyId = req.headers['company-id'];
        if (!companyId) return res.status(400).json({ error: 'Company ID required' });

        const stmt = db.prepare('SELECT * FROM hsn_codes WHERE company_id = ? ORDER BY code ASC');
        const hsnCodes = stmt.all(companyId);
        res.json(hsnCodes);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/hsn', authenticateToken, (req, res) => {
    try {
        const companyId = req.headers['company-id'];
        if (!companyId) return res.status(400).json({ error: 'Company ID required' });

        const { code, description, rate } = req.body;
        const stmt = db.prepare('INSERT INTO hsn_codes (company_id, code, description, rate) VALUES (?, ?, ?, ?)');
        const info = stmt.run(companyId, code, description, rate);
        res.json({ id: info.lastInsertRowid, ...req.body });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/hsn/:id', authenticateToken, (req, res) => {
    try {
        const { id } = req.params;
        const { code, description, rate } = req.body;
        const stmt = db.prepare('UPDATE hsn_codes SET code = ?, description = ?, rate = ? WHERE id = ?');
        stmt.run(code, description, rate, id);
        res.json({ message: 'HSN Code updated' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/hsn/:id', authenticateToken, (req, res) => {
    try {
        const { id } = req.params;
        const stmt = db.prepare('DELETE FROM hsn_codes WHERE id = ?');
        stmt.run(id);
        res.json({ message: 'HSN Code deleted' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update Product Formula Info (Base Qty)
app.put('/api/products/:id/formula-info', authenticateToken, (req, res) => {
    try {
        const { id } = req.params;
        const { base_qty } = req.body;
        db.prepare('UPDATE products SET formula_base_qty = ? WHERE id = ?').run(base_qty || 1, id);
        res.json({ message: 'Product formula info updated' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Helper to Recalculate Historical Production Consumption based on NEW Formula
const recalculateProductionHistory = (productId) => {
    // 1. Fetch Latest Formula
    const formula = db.prepare(`
        SELECT pf.*, p.packing_type as ingredient_unit, p.secondary_unit, p.conversion_rate, p.has_dual_units
        FROM product_formulas pf
        LEFT JOIN products p ON pf.ingredient_id = p.id
        WHERE pf.product_id = ?
    `).all(productId);

    // 2. Find ALL Historical Production Entries for this Product
    const productionEntries = db.prepare(`
        SELECT id, related_id, quantity_in, date, company_id 
        FROM stock_ledger 
        WHERE product_id = ? AND transaction_type = 'PRODUCTION_IN'
    `).all(productId);

    // 3. Iterate and Update Each
    for (const entry of productionEntries) {
        const productionId = entry.related_id; // For Manual Production, related_id is production_logs.id. For Auto, it might be different?
        // Note: Our system logic separates Manual (PRODUCTION_IN) vs Auto (PRODUCTION). 
        // This helper specifically targets PRODUCTION_IN (Manual Production Log) which uses FormulaScaling.
        // Auto-Production (from Sales) is type 'PRODUCTION'. We should probably handle THAT too if we want "All Places".

        // Let's check 'PRODUCTION' type entries too (Auto-produced from Sales)
        // actually let's just do a separate query or merge them.
        // For now, let's focus on PRODUCTION_IN as that is the direct definition of "I made X units".

        if (!productionId) continue;

        // A. DELETE existing Consumption (Inputs) for this Production
        // Linked by 'PRODUCTION_OUT' and related_id = productionId
        db.prepare(`
            DELETE FROM stock_ledger 
            WHERE related_id = ? AND transaction_type = 'PRODUCTION_OUT'
        `).run(productionId);

        db.prepare(`DELETE FROM production_items WHERE production_id = ?`).run(productionId);

        // B. RE-CALCULATE & INSERT New Inputs
        const outputQty = entry.quantity_in;

        const itemStmt = db.prepare(`
            INSERT INTO production_items (production_id, input_product_id, input_quantity)
            VALUES (?, ?, ?)
        `);

        // We also need to insert into stock_ledger
        const ledgerOutStmt = db.prepare(`
            INSERT INTO stock_ledger (company_id, date, product_id, transaction_type, related_id, quantity_in, quantity_out, trans_unit, trans_conversion_factor)
            VALUES (?, ?, ?, 'PRODUCTION_OUT', ?, 0, ?, ?, ?)
        `);

        for (const item of formula) {
            let quantityPerUnit = item.quantity;
            let transUnit = item.ingredient_unit;
            let transConv = 1.0;

            // Handle Dual Unit Preference
            if (item.unit_type === 'secondary' && item.conversion_rate) {
                // Unit Display logic for Ledger:
                transUnit = item.secondary_unit;
                transConv = item.conversion_rate;
            }

            let requiredQty = outputQty * quantityPerUnit;

            // Enforce Integer/Decimal Logic
            const unitType = item.ingredient_unit ? item.ingredient_unit.toUpperCase().trim() : '';

            // Fail-open strategy matches frontend
            const discreteUnits = ['NOS', 'PCS', 'BAG', 'BOX', 'PKT', 'SET', 'PAIR'];
            const isDiscrete = discreteUnits.some(u => unitType.includes(u));

            if (isDiscrete) {
                requiredQty = Math.ceil(requiredQty);
            }

            // Insert Production Item (Log)
            itemStmt.run(productionId, item.ingredient_id, requiredQty);

            // Insert Ledger Entry
            ledgerOutStmt.run(entry.company_id, entry.date, item.ingredient_id, productionId, requiredQty, transUnit, transConv);
        }
    }
};


app.get('/api/formulas/:productId', authenticateToken, (req, res) => {
    try {
        const { productId } = req.params;
        const formulas = db.prepare(`
            SELECT pf.*, p.name as ingredient_name, 
            CASE WHEN pf.unit_type = 'secondary' THEN p.secondary_unit ELSE p.packing_type END as unit
            FROM product_formulas pf
            JOIN products p ON pf.ingredient_id = p.id
            WHERE pf.product_id = ?
        `).all(productId);
        res.json(formulas);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/formulas', authenticateToken, (req, res) => {
    try {
        const { product_id, ingredient_id, quantity, unit_type } = req.body;

        const transaction = db.transaction(() => {
            const existing = db.prepare('SELECT id FROM product_formulas WHERE product_id = ? AND ingredient_id = ?').get(product_id, ingredient_id);

            if (existing) {
                db.prepare('UPDATE product_formulas SET quantity = ?, unit_type = ? WHERE id = ?').run(quantity, unit_type || 'primary', existing.id);
            } else {
                db.prepare('INSERT INTO product_formulas (product_id, ingredient_id, quantity, unit_type) VALUES (?, ?, ?, ?)').run(product_id, ingredient_id, quantity, unit_type || 'primary');
            }

            // Retroactive Update
            recalculateProductionHistory(product_id);
        });

        transaction();
        res.json({ message: 'Formula updated and historical stock recalculated.' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/formulas/:id', authenticateToken, (req, res) => {
    try {
        const { id } = req.params;

        const transaction = db.transaction(() => {
            // Get product_id before deleting
            const formula = db.prepare('SELECT product_id FROM product_formulas WHERE id = ?').get(id);
            if (!formula) throw new Error('Ingredient not found');

            db.prepare('DELETE FROM product_formulas WHERE id = ?').run(id);

            // Retroactive Update
            recalculateProductionHistory(formula.product_id);
        });

        transaction();
        res.json({ message: 'Ingredient removed and historical stock recalculated.' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Tax Report Route
app.get('/api/reports/tax-summary', authenticateToken, (req, res) => {
    try {
        const companyId = req.headers['company-id'];
        // const financialYear = req.headers['financial-year']; // helpful context, though strict year filter might be better
        const { year } = req.query; // specific calendar year if requested

        if (!companyId) return res.status(400).json({ error: 'Company ID required' });

        // Sales Data
        let salesQuery = `
            SELECT 
                strftime('%Y', date) as year, 
                strftime('%m', date) as month, 
                SUM(cgst + sgst) as tax_total
            FROM sales
            WHERE company_id = ?
        `;
        const salesParams = [companyId];
        if (year && year !== 'all') {
            salesQuery += ` AND strftime('%Y', date) = ?`;
            salesParams.push(year);
        }
        salesQuery += ` GROUP BY year, month ORDER BY year DESC, month DESC`;
        const salesData = db.prepare(salesQuery).all(...salesParams);

        // Purchase Data with RCM Split
        let purchaseQuery = `
            SELECT 
                strftime('%Y', date) as year, 
                strftime('%m', date) as month, 
                SUM(cgst + sgst) as tax_total,
                SUM(CASE WHEN IFNULL(tax_rate, 0) = 0 THEN rcm_tax_payable ELSE 0 END) as rcm_exempt,
                SUM(CASE WHEN IFNULL(tax_rate, 0) > 0 THEN rcm_tax_payable ELSE 0 END) as rcm_taxable
            FROM purchases
            WHERE company_id = ?
        `;
        const purchaseParams = [companyId];
        if (year && year !== 'all') {
            purchaseQuery += ` AND strftime('%Y', date) = ?`;
            purchaseParams.push(year);
        }
        purchaseQuery += ` GROUP BY year, month ORDER BY year DESC, month DESC`;
        const purchaseData = db.prepare(purchaseQuery).all(...purchaseParams);

        // Merge Data
        const reportData = {};

        // Helper to init month object
        const initMonth = (y, m) => {
            const key = `${y}-${m}`;
            if (!reportData[key]) {
                reportData[key] = {
                    year: y,
                    month: m,
                    salesTax: 0,
                    purchaseTax: 0,
                    rcmExempt: 0,
                    rcmTaxable: 0
                };
            }
            return reportData[key];
        };

        salesData.forEach(row => {
            const entry = initMonth(row.year, row.month);
            entry.salesTax = row.tax_total || 0;
        });

        purchaseData.forEach(row => {
            const entry = initMonth(row.year, row.month);
            entry.purchaseTax = row.tax_total || 0;
            entry.rcmExempt = row.rcm_exempt || 0;
            entry.rcmTaxable = row.rcm_taxable || 0;
        });

        // Convert to array and calculate totals
        const finalReport = Object.values(reportData).map(item => {
            const subTotal = (item.salesTax || 0) - (item.purchaseTax || 0);

            // Logic:
            // Standard (Taxable): (A - B) + C - C = (A - B)
            // Exempt: (A - B) + C
            // Combined: (A - B) + (rcmExempt + rcmTaxable) - (rcmTaxable)
            // Simplifies to: (A - B) + rcmExempt

            const totalRCMToAdd = (item.rcmExempt || 0) + (item.rcmTaxable || 0);
            const totalRCMToSubtract = (item.rcmTaxable || 0);

            const grandTotal = subTotal + totalRCMToAdd - totalRCMToSubtract;

            return {
                ...item,
                subTotal,
                rcmPayable: totalRCMToAdd, // For "Add RCM" column
                rcmInput: totalRCMToSubtract, // For "Less RCM" column
                grandTotal
            };
        });

        // Sort by Date Descending
        finalReport.sort((a, b) => {
            if (a.year !== b.year) return b.year - a.year;
            return b.month - a.month;
        });

        res.json(finalReport);

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Tax Report Monthly Route
app.get('/api/tax-report/monthly', authenticateToken, (req, res) => {
    try {
        const companyId = req.headers['company-id'];
        const financialYear = req.headers['financial-year'];
        if (!companyId) return res.status(400).json({ error: 'Company ID required' });

        let salesQuery = `SELECT * FROM sales WHERE company_id = ?`;
        let purchaseQuery = `SELECT * FROM purchases WHERE company_id = ?`;
        const params = [companyId];

        if (financialYear && financialYear !== 'all') {
            salesQuery += ` AND financial_year = ?`;
            purchaseQuery += ` AND financial_year = ?`;
            params.push(financialYear);
        }

        const sales = db.prepare(salesQuery).all(...params);
        const purchases = db.prepare(purchaseQuery).all(...params);
        const reportData = {};

        const initMonth = (y, m) => {
            const key = `${y}-${m}`;
            if (!reportData[key]) reportData[key] = { month: m, year: y, salesTax: 0, purchaseTax: 0, rcmTaxable: 0, rcmExempt: 0 };
            return reportData[key];
        };

        sales.forEach(inv => {
            const d = new Date(inv.date);
            const entry = initMonth(d.getFullYear(), d.getMonth() + 1);
            entry.salesTax += (inv.cgst || 0) + (inv.sgst || 0);
        });

        purchases.forEach(inv => {
            const d = new Date(inv.date);
            const entry = initMonth(d.getFullYear(), d.getMonth() + 1);
            const tax = (inv.cgst || 0) + (inv.sgst || 0);
            entry.purchaseTax += tax;
            if (inv.rcm_tax_payable > 0) {
                inv.tax_rate === 0 ? entry.rcmExempt += inv.rcm_tax_payable : entry.rcmTaxable += inv.rcm_tax_payable;
            }
        });

        const finalReport = Object.values(reportData).map(item => {
            const subTotal = (item.salesTax || 0) - (item.purchaseTax || 0);
            const totalRCMToAdd = (item.rcmExempt || 0) + (item.rcmTaxable || 0);
            const totalRCMToSubtract = (item.rcmTaxable || 0);
            return { ...item, subTotal, rcmPayable: totalRCMToAdd, rcmInput: totalRCMToSubtract, grandTotal: subTotal + totalRCMToAdd - totalRCMToSubtract };
        });

        finalReport.sort((a, b) => b.year !== a.year ? b.year - a.year : b.month - a.month);
        res.json(finalReport);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// --- Stock & Manufacturing Routes ---



// Get Detailed Stock Ledger (Date | Desc | Bill | Op | Rcpt | Tot | Sale | Iss | Cl)
app.get('/api/stock/ledger', authenticateToken, (req, res) => {
    try {
        const companyId = req.headers['company-id'];
        const { product_id, start_date, end_date } = req.query;

        if (!companyId) return res.status(400).json({ error: 'Company ID required' });

        let query = `
            SELECT 
                sl.id,
                sl.date,
                sl.transaction_type,
                sl.quantity_in,
                sl.quantity_out,
                sl.trans_unit,
                sl.trans_conversion_factor,
                sl.product_id,
                p.name as product_name,
                p.packing_type as primary_unit,
                p.secondary_unit,
                p.conversion_rate,
                p.has_dual_units as has_dual_units,
                p.secondary_unit as secondary_unit,
                p.conversion_rate as conversion_rate,
                
                -- Dynamic Description & Bill No based on Type
                CASE 
                    WHEN sl.transaction_type = 'PURCHASE' THEN 
                        (SELECT party.name FROM purchases pur JOIN parties party ON pur.party_id = party.id WHERE pur.id = sl.related_id)
                    WHEN sl.transaction_type = 'SALE' THEN 
                        (SELECT party.name FROM sales s JOIN parties party ON s.party_id = party.id WHERE s.id = sl.related_id)
                    WHEN sl.transaction_type = 'PRODUCTION_IN' THEN 
                        'Manufacturing Output'
                    WHEN sl.transaction_type = 'PRODUCTION_OUT' THEN 
                        (SELECT 'Consumed for ' || p.name 
                         FROM production_logs pl 
                         JOIN products p ON pl.output_product_id = p.id 
                         WHERE pl.id = sl.related_id)
                    WHEN sl.transaction_type = 'CONSUMPTION' THEN
                        COALESCE(
                            (SELECT 'Consumed for ' || p.name 
                             FROM sales s 
                             JOIN products p ON s.product_id = p.id
                             WHERE s.id = sl.related_id),
                            (SELECT 'Consumed for ' || p.name 
                             FROM production_logs pl 
                             JOIN products p ON pl.output_product_id = p.id 
                             WHERE pl.id = sl.related_id),
                            'Consumption'
                        )
                    WHEN sl.transaction_type = 'OPENING' THEN 
                        'Opening Stock'
                    ELSE sl.transaction_type
                END as description,

                CASE 
                    WHEN sl.transaction_type = 'PURCHASE' THEN 
                        (SELECT bill_no FROM purchases WHERE id = sl.related_id)
                    WHEN sl.transaction_type = 'SALE' THEN 
                        (SELECT bill_no FROM sales WHERE id = sl.related_id)
                    WHEN sl.transaction_type = 'PRODUCTION_IN' OR sl.transaction_type = 'PRODUCTION_OUT' THEN 
                        (SELECT batch_no FROM production_logs WHERE id = sl.related_id)
                    ELSE '-'
                END as bill_no

            FROM stock_ledger sl
            JOIN products p ON sl.product_id = p.id
            WHERE sl.company_id = ?
        `;

        const params = [companyId];

        if (product_id) {
            query += ` AND sl.product_id = ?`;
            params.push(product_id);
        }
        if (start_date) {
            query += ` AND sl.date >= ?`;
            params.push(start_date);
        }
        if (end_date) {
            query += ` AND sl.date <= ?`;
            params.push(end_date);
        }

        // Sort Priority:
        // 0. Opening Balance (Must be first)
        // 1. Receipts (Stock IN) - e.g. Purchase, Production Output - so running balance increases first
        // 2. Issues (Stock OUT) - e.g. Sale, Consumption - consumes the stock that just arrived
        query += ` 
            ORDER BY 
                sl.date ASC, 
                CASE 
                    WHEN sl.transaction_type = 'OPENING' THEN 0 
                    WHEN sl.quantity_in > 0 THEN 1
                    ELSE 2 
                END ASC, 
                sl.id ASC
        `;

        const transactions = db.prepare(query).all(...params);

        // Calculate Opening Balances for ALL products involved (or filtered one)
        let openingBalances = {};

        if (start_date) {
            let opQuery = `
                SELECT product_id, (COALESCE(SUM(quantity_in), 0) - COALESCE(SUM(quantity_out), 0)) as balance
                FROM stock_ledger 
                WHERE company_id = ? AND date < ?
            `;
            const opParams = [companyId, start_date];

            if (product_id) {
                opQuery += ` AND product_id = ?`;
                opParams.push(product_id);
            }

            opQuery += ` GROUP BY product_id`;

            const opResults = db.prepare(opQuery).all(...opParams);
            opResults.forEach(r => {
                openingBalances[r.product_id] = r.balance;
            });
        }

        // Return structured data so frontend can handle grouping & running totals correctly
        res.json({
            ledger: transactions,
            opening_balances: openingBalances
        });

    } catch (error) {
        console.error("Stock Ledger Error:", error);
        res.status(500).json({ error: error.message });
    }
});

// Get Current Stock Status
app.get('/api/stock', authenticateToken, (req, res) => {
    try {
        const companyId = req.headers['company-id'];
        const financialYear = req.headers['financial-year'];
        if (!companyId) return res.status(400).json({ error: 'Company ID required' });

        let startDate = '1970-01-01';
        let endDate = '2099-12-31';

        if (financialYear) {
            const parts = financialYear.split('-');
            if (parts.length === 2) {
                startDate = `${parts[0]}-04-01`;
                endDate = `${parts[1]}-03-31`;
            }
        }

        // Calculate Stock: Sum(In) - Sum(Out) SCOPED to Financial Year
        const stmt = db.prepare(`
            SELECT 
                p.id as product_id,
                p.name as product_name,
                p.packing_type as unit,
                p.has_dual_units,
                p.secondary_unit,
                p.conversion_rate,
                COALESCE(SUM(sl.quantity_in), 0) as total_in,
                COALESCE(SUM(sl.quantity_out), 0) as total_out,
                (COALESCE(SUM(sl.quantity_in), 0) - COALESCE(SUM(sl.quantity_out), 0)) as current_stock
            FROM products p
            LEFT JOIN stock_ledger sl ON p.id = sl.product_id AND sl.company_id = ? AND sl.date >= ? AND sl.date <= ?
            WHERE p.company_id = ?
            GROUP BY p.id
        `);

        const stock = stmt.all(companyId, startDate, endDate, companyId);
        res.json(stock);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Create Production Entry (Manufacturing)
// Debug Repair Route
app.post('/api/debug/repair', (req, res) => {
    try {
        const FIX_YEAR_START = '2024-04-01';
        let log = [];

        // 1. Fix Opening Stock Dates
        const openRes = db.prepare(`
            UPDATE stock_ledger
            SET date = ?
            WHERE transaction_type = 'OPENING'
        `).run(FIX_YEAR_START);
        log.push(`Updated ${openRes.changes} Opening Stock entries to ${FIX_YEAR_START}.`);

        // 2. Backfill Sales
        const missingSales = db.prepare(`
            SELECT s.* FROM sales s
            LEFT JOIN stock_ledger sl ON sl.related_id = s.id AND sl.transaction_type = 'SALE'
            WHERE sl.id IS NULL AND s.product_id IS NOT NULL 
        `).all();

        const insertSale = db.prepare(`
            INSERT INTO stock_ledger (company_id, date, product_id, transaction_type, related_id, quantity_out, quantity_in)
            VALUES (?, ?, ?, 'SALE', ?, ?, 0)
        `);

        let sCount = 0;
        const transaction = db.transaction(() => {
            for (const sale of missingSales) {
                const qty = (sale.bags || 0) * (sale.conversion_factor || 1.0);
                insertSale.run(sale.company_id, sale.date, sale.product_id, sale.id, qty);
                sCount++;
            }
        });
        transaction();
        log.push(`Backfilled ${sCount} Sales.`);

        // 3. Backfill Purchases
        const missingPurchases = db.prepare(`
            SELECT p.* FROM purchases p
            LEFT JOIN stock_ledger sl ON sl.related_id = p.id AND sl.transaction_type = 'PURCHASE'
            WHERE sl.id IS NULL AND p.product_id IS NOT NULL
        `).all();

        const insertPurchase = db.prepare(`
            INSERT INTO stock_ledger (company_id, date, product_id, transaction_type, related_id, quantity_in, quantity_out)
            VALUES (?, ?, ?, 'PURCHASE', ?, ?, 0)
        `);

        let pCount = 0;
        const pTx = db.transaction(() => {
            for (const pur of missingPurchases) {
                const qty = (pur.quantity || 0) * (pur.conversion_factor || 1.0);
                insertPurchase.run(pur.company_id, pur.date, pur.product_id, pur.id, qty);
                pCount++;
            }
        });
        pTx();
        log.push(`Backfilled ${pCount} Purchases.`);

        res.json({ message: 'Repair Successful', details: log });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/production', authenticateToken, (req, res) => {
    try {
        const companyId = req.headers['company-id'];
        if (!companyId) return res.status(400).json({ error: 'Company ID required' });

        const { date, batch_no, output_product_id, output_quantity, inputs, notes } = req.body;

        const transaction = db.transaction(() => {
            // 1. Create Production Log
            const prodStmt = db.prepare(`
                INSERT INTO production_logs (company_id, date, batch_no, output_product_id, output_quantity, notes)
                VALUES (?, ?, ?, ?, ?, ?)
            `);
            const prodInfo = prodStmt.run(companyId, date, batch_no || null, output_product_id, output_quantity, notes || '');
            const productionId = prodInfo.lastInsertRowid;

            // 2. Add Output to Stock Ledger (IN)
            const ledgerIn = db.prepare(`
                INSERT INTO stock_ledger (company_id, date, product_id, transaction_type, related_id, quantity_in, quantity_out)
                VALUES (?, ?, ?, 'PRODUCTION_IN', ?, ?, 0)
            `);
            ledgerIn.run(companyId, date, output_product_id, productionId, output_quantity);

            // 3. Process Inputs
            const itemStmt = db.prepare(`
                INSERT INTO production_items (production_id, input_product_id, input_quantity)
                VALUES (?, ?, ?)
            `);


            for (const item of inputs) {
                // inputs array: [{ product_id, quantity, unit_mode }]
                let qty = parseFloat(item.quantity) || 0;
                let finalQty = qty;
                let transUnit = ''; // Optional: Store unit name if we fetched it
                let transConv = 1;

                // Handle Conversion if Secondary
                if (item.unit_mode === 'secondary') {
                    const prod = db.prepare('SELECT packing_type, secondary_unit, conversion_rate FROM products WHERE id = ?').get(item.product_id);
                    if (prod) {
                        transUnit = prod.secondary_unit;
                        transConv = prod.conversion_rate || 1;
                        const pUnit = (prod.packing_type || '').toUpperCase();
                        const sUnit = (prod.secondary_unit || '').toUpperCase();

                        const smallUnits = ['KG', 'KGS', 'KILOGRAM', 'GM', 'GRAM', 'GMS', 'LTR', 'LITER', 'ML', 'METER', 'MTR', 'NOS', 'PCS', 'PIECE'];
                        const largeUnits = ['BAG', 'BOX', 'PACK', 'PKT', 'DRUM', 'CAN', 'BOTTLE', 'JAR', 'TIN', 'BUNDLE', 'ROLL', 'CRT', 'CARTON'];

                        const isSecSmall = smallUnits.some(u => sUnit.includes(u));
                        const isPrimLarge = largeUnits.some(u => pUnit.includes(u));

                        if (isSecSmall && isPrimLarge) {
                            // Sec -> Prim (Divide)
                            finalQty = qty / transConv;
                        } else if (smallUnits.some(u => pUnit.includes(u)) && largeUnits.some(u => sUnit.includes(u))) {
                            // Prim -> Sec (Wait, if Sec is Large? Then Multiply?)
                            // Example: Prim=Kg, Sec=Bag. Input=1 Bag. Base=20 Kg.
                            finalQty = qty * transConv;
                        } else {
                            // Default Multiply
                            finalQty = qty * transConv;
                        }
                    }
                } else {
                    // Primary - Maybe fetch unit name for ledger clarity?
                    const prod = db.prepare('SELECT packing_type FROM products WHERE id = ?').get(item.product_id);
                    if (prod) transUnit = prod.packing_type;
                }

                itemStmt.run(productionId, item.product_id, qty);

                // Store in Ledger as OUT (Base Qty)
                // Also store trans_unit/factor for correct display in Ledger
                const ledgerOutStmt = db.prepare(`
                    INSERT INTO stock_ledger (company_id, date, product_id, transaction_type, related_id, quantity_in, quantity_out, trans_unit, trans_conversion_factor)
                    VALUES (?, ?, ?, 'PRODUCTION_OUT', ?, 0, ?, ?, ?)
                `);
                ledgerOutStmt.run(companyId, date, item.product_id, productionId, finalQty, transUnit, transConv);
            }

            return productionId;
        });

        const id = transaction();
        res.json({ message: 'Production entry created successfully', id });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Adjust Production Quantity (Editable Production)
app.put('/api/stock/adjust-production/:id', authenticateToken, (req, res) => {
    try {
        const { id } = req.params; // This is the stock_ledger.id
        const { quantity } = req.body; // New Output Quantity

        if (!quantity || quantity <= 0) return res.status(400).json({ error: 'Valid quantity required' });

        const transaction = db.transaction(() => {
            // 1. Fetch the Target Entry
            const entry = db.prepare('SELECT * FROM stock_ledger WHERE id = ?').get(id);
            if (!entry) throw new Error('Entry not found');

            // 2. Identify Type: PRODUCTION (Auto) or PRODUCTION_IN (Manual)
            if (entry.transaction_type === 'PRODUCTION') {
                // AUTO-PRODUCTION (from Sales)
                // Logic: Update Quantity -> Re-calculate Consumption based on Formula

                // Update Production Entry
                db.prepare('UPDATE stock_ledger SET quantity_in = ? WHERE id = ?').run(quantity, id);

                // Update Linked Sale? No, the Sale quantity (bags) is driven by the bill. 
                // However, the deficit calculation uses CURRENT stock. 
                // This is an "Admin Override". We assume the user wants to FORCE this production amount.
                // We do NOT change the related Sale quantity. 

                // RE-CALCULATE CONSUMPTION
                // Delete old consumption entries linked to this Sale (related_id is sale_id)
                // BUT wait, related_id points to the Sale. If we delete all consumption for that sale, we might affect other things?
                // Actually, for 'PRODUCTION', related_id is sale_id. And 'CONSUMPTION' also has related_id = sale_id.
                // We should delete 'CONSUMPTION' where related_id = entry.related_id

                const saleId = entry.related_id;

                db.prepare(`
                    DELETE FROM stock_ledger 
                    WHERE related_id = ? AND transaction_type = 'CONSUMPTION'
                `).run(saleId);

                // Re-calculate Consumption based on New Qty & Formula
                // Fetch Formula including Unit constraints
                const formula = db.prepare(`
                    SELECT pf.*, p.packing_type as ingredient_unit, p.secondary_unit, p.conversion_rate, p.has_dual_units
                    FROM product_formulas pf
                    LEFT JOIN products p ON pf.ingredient_id = p.id
                    WHERE pf.product_id = ?
                `).all(entry.product_id);

                for (const item of formula) {
                    let quantityPerUnit = item.quantity;
                    let transUnit = item.ingredient_unit;
                    let transConv = 1.0;

                    // Handle Dual Unit Preference (Secondary vs Primary)
                    if (item.unit_type === 'secondary' && item.conversion_rate) {
                        const secUnit = item.secondary_unit ? item.secondary_unit.toUpperCase() : '';
                        const primUnit = item.ingredient_unit ? item.ingredient_unit.toUpperCase() : '';
                        const rate = parseFloat(item.conversion_rate);

                        const smallUnits = ['KG', 'KGS', 'KILOGRAM', 'GM', 'GRAM', 'GMS', 'LTR', 'LITER', 'ML', 'METER', 'MTR', 'NOS', 'PCS', 'PIECE'];
                        const largeUnits = ['BAG', 'BOX', 'PACK', 'PKT', 'DRUM', 'CAN', 'BOTTLE', 'JAR', 'TIN', 'BUNDLE', 'ROLL', 'CRT', 'CARTON'];

                        const isSecSmall = smallUnits.some(u => secUnit.includes(u));
                        const isPrimLarge = largeUnits.some(u => primUnit.includes(u));

                        if (isSecSmall && isPrimLarge && rate > 1) {
                            quantityPerUnit = item.quantity / rate;
                        } else {
                            quantityPerUnit = item.quantity * rate;
                        }

                        transUnit = item.secondary_unit;
                        transConv = item.conversion_rate;
                    }

                    let requiredQty = quantity * quantityPerUnit;

                    // Enforce Integer Consumption
                    const unitType = item.ingredient_unit ? item.ingredient_unit.toUpperCase().trim() : '';
                    // Allow decimals if unit is typically decimal OR if the product supports Dual Units (e.g. Bags splitting into Kgs)
                    const isDecimalAllowed = ['KG', 'KGS', 'KILOGRAM', 'LTR', 'LITER', 'GM', 'GRAM'].some(u => unitType.includes(u)) || !!item.has_dual_units;

                    if (!isDecimalAllowed) {
                        requiredQty = Math.ceil(requiredQty);
                    }

                    db.prepare(`
                        INSERT INTO stock_ledger (company_id, date, product_id, transaction_type, related_id, quantity_out, quantity_in, trans_unit, trans_conversion_factor)
                        VALUES (?, ?, ?, 'CONSUMPTION', ?, ?, 0, ?, ?)
                    `).run(entry.company_id, entry.date, item.ingredient_id, saleId, requiredQty, transUnit, transConv);
                }

            } else if (entry.transaction_type === 'PRODUCTION_IN') {
                // MANUAL PRODUCTION
                // Logic: Calculate Ratio, Scale Ingredients
                const oldQty = entry.quantity_in;
                const ratio = quantity / oldQty;

                // Update Ledger Entry
                db.prepare('UPDATE stock_ledger SET quantity_in = ? WHERE id = ?').run(quantity, id);

                // Update Production Log (related_id points to production_logs.id)
                const productionId = entry.related_id;
                db.prepare('UPDATE production_logs SET output_quantity = ? WHERE id = ?').run(quantity, productionId);

                // Scale Production Items (Inputs)
                const items = db.prepare('SELECT * FROM production_items WHERE production_id = ?').all(productionId);

                const updateItem = db.prepare('UPDATE production_items SET input_quantity = ? WHERE id = ?');
                const updateLedgerOut = db.prepare(`
                    UPDATE stock_ledger 
                    SET quantity_out = ? 
                    WHERE related_id = ? AND product_id = ? AND transaction_type = 'PRODUCTION_OUT'
                `);

                for (const item of items) {
                    // Check unit for rounding?
                    // We need product info for unit.
                    const prod = db.prepare('SELECT packing_type FROM products WHERE id = ?').get(item.input_product_id);

                    let newReqQty = item.input_quantity * ratio;

                    const unitType = prod && prod.packing_type ? prod.packing_type.toUpperCase().trim() : '';
                    const isDecimalAllowed = unitType === 'KG' || unitType === 'KGS' || unitType === 'KILOGRAM';

                    if (!isDecimalAllowed) {
                        newReqQty = Math.ceil(newReqQty); // Apply rounding to scaled value
                    }

                    updateItem.run(newReqQty, item.id);
                    // Match ledger by related_id (productionId) and product_id
                    updateLedgerOut.run(newReqQty, productionId, item.input_product_id);
                }

            } else {
                throw new Error('This entry is not a Production entry.');
            }
        });

        transaction();
        res.json({ message: 'Production adjusted successfully' });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Delete Production Entry
app.delete('/api/stock/production/:id', authenticateToken, (req, res) => {
    try {
        const { id } = req.params; // stock_ledger.id of the PRODUCTION logic

        const transaction = db.transaction(() => {
            const entry = db.prepare('SELECT * FROM stock_ledger WHERE id = ?').get(id);
            if (!entry) throw new Error('Entry not found');

            if (entry.transaction_type === 'PRODUCTION') {
                // Auto-Generated from Sale
                throw new Error('Cannot delete auto-generated production. Please delete the associated Sale entry instead.');
            } else if (entry.transaction_type === 'PRODUCTION_IN') {
                // Manual Production
                const productionId = entry.related_id;

                // 1. Delete Production Log
                db.prepare('DELETE FROM production_logs WHERE id = ?').run(productionId);

                // 2. Delete Production Items
                db.prepare('DELETE FROM production_items WHERE production_id = ?').run(productionId);

                // 3. Delete Stock Ledger Entry (The Output)
                db.prepare('DELETE FROM stock_ledger WHERE id = ?').run(id);

                // 4. Delete Stock Ledger Entries for Inputs (PRODUCTION_OUT)
                db.prepare(`
                    DELETE FROM stock_ledger 
                    WHERE related_id = ? AND transaction_type = 'PRODUCTION_OUT'
                `).run(productionId);
            } else {
                throw new Error('Invalid production entry type');
            }
        });

        transaction();
        res.json({ message: 'Production entry deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/debug/cleanup', authenticateToken, (req, res) => {
    try {
        let deletedCount = 0;
        const transaction = db.transaction(() => {
            // Delete Stock Ledger entries linked to non-existent Sales
            const info = db.prepare(`
                DELETE FROM stock_ledger 
                WHERE transaction_type IN ('SALE', 'PRODUCTION', 'CONSUMPTION') 
                AND related_id NOT IN (SELECT id FROM sales)
            `).run();
            deletedCount = info.changes;
        });
        transaction();
        res.json({ message: `Cleanup successful. Removed ${deletedCount} orphaned entries.` });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.listen(port, '0.0.0.0', () => {
    console.log(`Server running on port ${port}`);
});

// Graceful Shutdown
process.on('SIGINT', () => {
    console.log('Closing database connection...');
    db.close();
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('Closing database connection...');
    db.close();
    process.exit(0);
});
