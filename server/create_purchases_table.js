const Database = require('better-sqlite3');
const db = new Database('sales_app.db');

try {
    db.exec(`
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
    console.log("Purchases table created successfully.");
} catch (error) {
    console.error("Error creating table:", error.message);
}
