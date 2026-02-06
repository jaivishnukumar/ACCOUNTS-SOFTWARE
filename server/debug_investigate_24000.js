const db = require('better-sqlite3')('sales_app.db');

const pva = db.prepare("SELECT id FROM products WHERE name LIKE '%PVA%'").get();
const entries = db.prepare(`SELECT * FROM stock_ledger WHERE product_id = ? AND transaction_type = 'CONSUMPTION' ORDER BY id DESC LIMIT 1`).all(pva.id);

if (entries.length > 0) {
    const ent = entries[0];
    const sale = db.prepare("SELECT bags FROM sales WHERE id = ?").get(ent.related_id);
    if (sale) {
        console.log(`SOLD_QTY: ${sale.bags}`);
        console.log(`ACTUAL_LEDGER: ${ent.quantity_out * 20}`);
    } else {
        console.log("SALE_NOT_FOUND");
    }
} else {
    console.log("NO_ENTRY");
}
