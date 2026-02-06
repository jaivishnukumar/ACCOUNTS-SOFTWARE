const db = require('better-sqlite3')('sales_app.db');

console.log("=== SCHEMA ===");
const cols = db.pragma('table_info(sales)');
console.table(cols.map(c => ({ cid: c.cid, name: c.name, type: c.type })));

console.log("\n=== DATA SAMPLE ===");
const rows = db.prepare("SELECT id, bill_no, product_id FROM sales ORDER BY id DESC LIMIT 5").all();
console.table(rows);
