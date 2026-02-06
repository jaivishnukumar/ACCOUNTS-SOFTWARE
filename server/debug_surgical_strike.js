const db = require('better-sqlite3')('sales_app.db');

console.log("--- SURGICAL STRIKE STARTED ---");

const targetDate = '2025-12-16'; // Today
const pva = db.prepare("SELECT id FROM products WHERE name LIKE '%PVA%'").get();

if (pva) {
    // Delete ALL Consumption for PVA on this date
    // User can re-enter pending work. This is the only way to clear "Ghosts".

    const info = db.prepare(`
        DELETE FROM stock_ledger 
        WHERE product_id = ? 
        AND transaction_type = 'CONSUMPTION'
        AND date = ?
    `).run(pva.id, targetDate);

    console.log(`Deleted ${info.changes} entries for PVA on ${targetDate}.`);

    // Also cleanup any "Production" entries on this date that might be orphans 
    // related to the "4 CAN" issue (Liquid Gum)
    const gum = db.prepare("SELECT id FROM products WHERE name LIKE '%Liquid Gum%'").get();
    if (gum) {
        const info2 = db.prepare(`
            DELETE FROM stock_ledger 
            WHERE product_id = ? 
            AND transaction_type = 'PRODUCTION'
            AND date = ?
        `).run(gum.id, targetDate);
        console.log(`Deleted ${info2.changes} PRODUCTION entries for Liquid Gum on ${targetDate}.`);
    }

}
