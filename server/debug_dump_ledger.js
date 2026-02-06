const db = require('better-sqlite3')('sales_app.db');

console.log("--- DUMPING ALL PVA CONSUMPTION ---");

const pva = db.prepare("SELECT id FROM products WHERE name LIKE '%PVA%'").get();

if (!pva) {
    console.log("PVA Product not found");
} else {
    const entries = db.prepare(`
        SELECT sl.id, sl.date, sl.transaction_type, sl.quantity_out, sl.related_id, sl.trans_unit
        FROM stock_ledger sl
        WHERE sl.product_id = ? AND sl.quantity_out > 0
    `).all(pva.id);

    entries.forEach(e => {
        // Convert to KGS for visibility if stored as Bags
        // Assuming 1 Bag = 20 Kgs. If transaction is in KGS, it's direct.
        const kgs = (e.trans_unit === 'BAG') ? e.quantity_out * 20 : e.quantity_out;

        console.log(`RowID: ${e.id} | Date: ${e.date} | Type: ${e.transaction_type} | QtyOut: ${e.quantity_out} | Unit: ${e.trans_unit || 'BASE'} | (~${kgs} Kgs) | RelatedID: ${e.related_id}`);
    });
}
