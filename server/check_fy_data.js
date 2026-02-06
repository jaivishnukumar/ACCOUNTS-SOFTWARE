const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'sales_app.db');
const db = new Database(dbPath, { readonly: true });

console.log("Checking Data for 2025-2026...");

const sales = db.prepare("SELECT count(*) as count FROM sales WHERE financial_year = '2025-2026'").get();
console.log(`Sales in 2025-2026: ${sales.count}`);

const allYears = db.prepare("SELECT DISTINCT financial_year FROM sales").all();
console.log("Available Financial Years in DB:", allYears.map(y => y.financial_year));
