const express = require('express');
const cors = require('cors');
const Database = require('better-sqlite3');
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

// Database Setup
const path = require('path');
const dbPath = path.join(__dirname, 'sales_app.db');
const db = new Database(dbPath);

// Initialize Tables
db.exec(`
  CREATE TABLE IF NOT EXISTS companies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    address TEXT,
    gst_number TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS parties (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id INTEGER,
    name TEXT NOT NULL,
    gst_number TEXT,
    address TEXT,
    contact TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(company_id) REFERENCES companies(id)
  );

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    role TEXT DEFAULT 'user',
    is_approved INTEGER DEFAULT 0, -- 0: Pending, 1: Approved, 2: Blocked
    max_companies INTEGER DEFAULT 5,
    allowed_years TEXT DEFAULT 'all', -- 'all' or comma-separated list '2024-2025,2025-2026'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS invite_codes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL UNIQUE,
    is_used INTEGER DEFAULT 0,
    created_by TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS sales (
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

  CREATE TABLE IF NOT EXISTS hsn_codes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id INTEGER,
    code TEXT NOT NULL,
    description TEXT,
    rate REAL NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(company_id) REFERENCES companies(id)
  );

  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id INTEGER,
    name TEXT NOT NULL,
    hsn_code TEXT NOT NULL,
    tax_rate REAL NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(company_id) REFERENCES companies(id)
  );

  CREATE TABLE IF NOT EXISTS purchases (
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
    try {
        db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
        if (defaultVal !== null) {
            db.exec(`UPDATE ${table} SET ${column} = ${defaultVal} WHERE ${column} IS NULL`);
        }
    } catch (e) { } // Ignore if exists
};

safeColumnAdd('sales', 'tax_rate', 'REAL');
safeColumnAdd('sales', 'company_id', 'INTEGER', 1);
safeColumnAdd('sales', 'financial_year', 'TEXT', "'2024-2025'");
safeColumnAdd('parties', 'company_id', 'INTEGER', 1);
safeColumnAdd('products', 'packing_type', 'TEXT', "'BAG'");
safeColumnAdd('purchases', 'auto_charges', 'REAL', 0);
safeColumnAdd('purchases', 'expenses_total', 'REAL', 0);
safeColumnAdd('purchases', 'rcm_tax_payable', 'REAL', 0);

// Migrate HSN Codes to Products
const migrateHSNToProducts = () => {
    try {
        const productsCount = db.prepare('SELECT COUNT(*) as count FROM products').get().count;
        if (productsCount === 0) {
            const hsnCodes = db.prepare('SELECT * FROM hsn_codes').all();
            const insert = db.prepare('INSERT INTO products (company_id, name, hsn_code, tax_rate, packing_type) VALUES (?, ?, ?, ?, ?)');
            const transaction = db.transaction((codes) => {
                for (const hsn of codes) {
                    insert.run(hsn.company_id, hsn.description || `Product ${hsn.code}`, hsn.code, hsn.rate, 'BAG');
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
        const info = stmt.run(name, address, gst_number, id);
        res.json({ message: 'Company updated' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/companies/:id', authenticateToken, (req, res) => {
    try {
        const { id } = req.params;
        const stmt = db.prepare('DELETE FROM companies WHERE id = ?');
        stmt.run(id);
        res.json({ message: 'Company deleted' });
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
      SELECT s.*, p.name as party_name, p.gst_number 
      FROM sales s 
      LEFT JOIN parties p ON s.party_id = p.id
      WHERE s.company_id = ?
    `;
        const params = [companyId];

        // Filter by Financial Year if provided, else rely on manual filters
        if (financialYear && financialYear !== 'all') {
            query += ` AND s.financial_year = ?`;
            params.push(financialYear);
        }

        if (month && year && month !== 'all' && year !== 'all') {
            query += ` AND strftime('%m', s.date) = ? AND strftime('%Y', s.date) = ?`;
            params.push(month.toString().padStart(2, '0'), year.toString());
        } else if (year && year !== 'all') {
            query += ` AND strftime('%Y', s.date) = ?`;
            params.push(year.toString());
        }

        if (hsn) {
            query += ` AND s.hsn_code = ?`;
            params.push(hsn);
        }

        if (party) {
            query += ` AND p.name LIKE ?`;
            params.push(`%${party}%`);
        }

        query += ` ORDER BY s.date DESC`;

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

        const { date, bill_no, party_id, bill_value, bags, unit, hsn_code, tax_rate, cgst, sgst, total } = req.body;
        const stmt = db.prepare(`
      INSERT INTO sales (company_id, financial_year, date, bill_no, party_id, bill_value, bags, unit, hsn_code, tax_rate, cgst, sgst, total)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
        const info = stmt.run(companyId, financialYear, date, bill_no, party_id, bill_value, bags, unit, hsn_code, tax_rate, cgst, sgst, total);
        res.json({ id: info.lastInsertRowid, ...req.body });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/sales/:id', authenticateToken, (req, res) => {
    try {
        const { id } = req.params;
        const stmt = db.prepare('DELETE FROM sales WHERE id = ?');
        stmt.run(id);
        res.json({ message: 'Sale deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/sales/:id', authenticateToken, (req, res) => {
    try {
        const { id } = req.params;
        const { date, bill_no, party_id, bill_value, bags, unit, hsn_code, tax_rate, cgst, sgst, total } = req.body;

        const stmt = db.prepare(`
            UPDATE sales 
            SET date = ?, bill_no = ?, party_id = ?, bill_value = ?, bags = ?, unit = ?, hsn_code = ?, tax_rate = ?, cgst = ?, sgst = ?, total = ?
            WHERE id = ?
        `);

        stmt.run(date, bill_no, party_id, bill_value, bags, unit, hsn_code, tax_rate, cgst, sgst, total, id);
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

        query += ` ORDER BY p.date DESC`;

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
            date, bill_no, received_date, party_id, gst_number, hsn_code, quantity, unit,
            taxable_value, tax_rate, cgst, sgst, bill_value,
            freight_charges, loading_charges, unloading_charges, auto_charges, expenses_total, rcm_tax_payable
        } = req.body;

        const stmt = db.prepare(`
      INSERT INTO purchases (
        company_id, financial_year, date, bill_no, received_date, party_id, gst_number, hsn_code, 
        quantity, unit, taxable_value, tax_rate, cgst, sgst, bill_value,
        freight_charges, loading_charges, unloading_charges, auto_charges, expenses_total, rcm_tax_payable
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

        const info = stmt.run(
            companyId, financialYear, date, bill_no, received_date, party_id, gst_number, hsn_code,
            quantity, unit, taxable_value, tax_rate, cgst, sgst, bill_value,
            freight_charges || 0, loading_charges || 0, unloading_charges || 0, auto_charges || 0, expenses_total || 0, rcm_tax_payable || 0
        );
        res.json({ id: info.lastInsertRowid, ...req.body });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/purchases/:id', authenticateToken, (req, res) => {
    try {
        const { id } = req.params;
        const {
            date, bill_no, received_date, party_id, gst_number, hsn_code, quantity, unit,
            taxable_value, tax_rate, cgst, sgst, bill_value,
            freight_charges, loading_charges, unloading_charges, auto_charges, expenses_total, rcm_tax_payable
        } = req.body;

        const stmt = db.prepare(`
            UPDATE purchases 
            SET date = ?, bill_no = ?, received_date = ?, party_id = ?, gst_number = ?, hsn_code = ?, 
                quantity = ?, unit = ?, taxable_value = ?, tax_rate = ?, cgst = ?, sgst = ?, bill_value = ?,
                freight_charges = ?, loading_charges = ?, unloading_charges = ?, auto_charges = ?, expenses_total = ?, rcm_tax_payable = ?
            WHERE id = ?
        `);

        stmt.run(
            date, bill_no, received_date, party_id, gst_number, hsn_code,
            quantity, unit, taxable_value, tax_rate, cgst, sgst, bill_value,
            freight_charges || 0, loading_charges || 0, unloading_charges || 0, auto_charges || 0, expenses_total || 0, rcm_tax_payable || 0,
            id
        );
        res.json({ message: 'Purchase updated successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/purchases/:id', authenticateToken, (req, res) => {
    try {
        const { id } = req.params;
        const stmt = db.prepare('DELETE FROM purchases WHERE id = ?');
        stmt.run(id);
        res.json({ message: 'Purchase deleted successfully' });
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



// Product Routes
app.get('/api/products', authenticateToken, (req, res) => {
    try {
        const companyId = req.headers['company-id'];
        if (!companyId) return res.status(400).json({ error: 'Company ID required' });

        const stmt = db.prepare('SELECT * FROM products WHERE company_id = ? ORDER BY name ASC');
        const products = stmt.all(companyId);
        res.json(products);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/products', authenticateToken, (req, res) => {
    try {
        const companyId = req.headers['company-id'];
        if (!companyId) return res.status(400).json({ error: 'Company ID required' });

        const { name, hsn_code, tax_rate, packing_type } = req.body;
        const stmt = db.prepare('INSERT INTO products (company_id, name, hsn_code, tax_rate, packing_type) VALUES (?, ?, ?, ?, ?)');
        const info = stmt.run(companyId, name, hsn_code, tax_rate, packing_type || 'BAG');
        res.json({ id: info.lastInsertRowid, ...req.body });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/products/:id', authenticateToken, (req, res) => {
    try {
        const { id } = req.params;
        const { name, hsn_code, tax_rate, packing_type } = req.body;
        const stmt = db.prepare('UPDATE products SET name = ?, hsn_code = ?, tax_rate = ?, packing_type = ? WHERE id = ?');
        stmt.run(name, hsn_code, tax_rate, packing_type || 'BAG', id);
        res.json({ message: 'Product updated' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

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

// Tax Report Route
app.get('/api/reports/tax-summary', authenticateToken, (req, res) => {
    try {
        const companyId = req.headers['company-id'];
        const financialYear = req.headers['financial-year']; // helpful context, though strict year filter might be better
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

app.listen(port, '0.0.0.0', () => {
    console.log(`Server running on port ${port}`);
});
