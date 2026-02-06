const db = require('better-sqlite3')('sales_app.db');

// Fetch the suspicious 40 KG entry
// User said: 16/12/2025 CONSUMPTION ... 40.00 KGS
const entry = db.prepare(`
    SELECT sl.*, p.name as product_name
    FROM stock_ledger sl
    JOIN products p ON sl.product_id = p.id
    WHERE sl.transaction_type = 'CONSUMPTION' 
    AND sl.quantity_out > 0
    ORDER BY sl.id DESC
    LIMIT 5
`).all();

console.log("--- SUSPICIOUS ENTRIES ---");
entry.forEach(e => {
    console.log(`ID: ${e.id} | Date: ${e.date} | Product: ${e.product_name}`);
    console.log(`   Type: ${e.transaction_type} | QtyOut: ${e.quantity_out} | RelatedID: ${e.related_id}`);

    // Check if Related ID exists in Sales
    const sale = db.prepare('SELECT id, bill_no FROM sales WHERE id = ?').get(e.related_id);
    if (sale) {
        console.log(`   -> Linked to SALE #${sale.id} (Bill: ${sale.bill_no})`);
    } else {
        console.log(`   -> SALE NOT FOUND (Orphan?)`);

        // Check if Linked to Production Log?
        const prod = db.prepare('SELECT id, batch_no FROM production_logs WHERE id = ?').get(e.related_id);
        if (prod) {
            console.log(`   -> Linked to MANUAL PRODUCTION #${prod.id} (Batch: ${prod.batch_no})`);
        } else {
            console.log(`   -> NOT FOUND in Sales or ProductionLogs.`);
        }
    }
    console.log("------------------------------------------------");
});
