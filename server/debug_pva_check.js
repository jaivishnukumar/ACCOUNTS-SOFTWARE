const db = require('better-sqlite3')('sales_app.db');

const pva = db.prepare("SELECT * FROM products WHERE name LIKE '%PVA%'").get();
console.log("PVA Details:", pva);

if (pva) {
    const ledger = db.prepare("SELECT * FROM stock_ledger WHERE product_id = ? LIMIT 5").all(pva.id);
    console.log("PVA Ledger Samples:", ledger);
}
