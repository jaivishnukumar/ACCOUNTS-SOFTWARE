const db = require('better-sqlite3')('sales_app.db');

console.log("--- GHOST HUNTER STARTED ---");

// 1. Find Ledger Entries linked to Sales that don't exist
// Types: SALE, PRODUCTION, CONSUMPTION (all linked to sales.id as related_id)
// Note: Manual Production uses 'PRODUCTION_IN'/'PRODUCTION_OUT', linked to production_logs.
// We only target the Auto-Production types here.

const ghosts = db.prepare(`
    SELECT sl.id, sl.date, sl.transaction_type, sl.quantity_out, sl.quantity_in, sl.related_id, p.name as product_name
    FROM stock_ledger sl
    LEFT JOIN sales s ON sl.related_id = s.id
    JOIN products p ON sl.product_id = p.id
    WHERE sl.transaction_type IN ('SALE', 'PRODUCTION', 'CONSUMPTION')
    AND s.id IS NULL
`).all();

if (ghosts.length === 0) {
    console.log("No Ghost Entries found. The entries you see must belong to an EXISTING Sale.");

    // If no ghosts, list ALL active sales for Liquid Gum to show the user "Hey, you have another bill 1024"
    const active = db.prepare(`
        SELECT s.id, s.bill_no, sl.quantity_out
        FROM stock_ledger sl
        JOIN sales s ON sl.related_id = s.id
        WHERE sl.transaction_type = 'CONSUMPTION'
        AND sl.quantity_out > 0
    `).all();

    console.log("\n--- ACTIVE SUSPECTS ---");
    active.forEach(a => {
        console.log(`Sale #${a.id} (Bill: ${a.bill_no}) -> Consumption: ${a.quantity_out} (Check this one!)`);
    });

} else {
    console.log(`Found ${ghosts.length} Orphaned Entries.`);
    ghosts.forEach(g => {
        console.log(`[DELETE] ID: ${g.id} | ${g.date} | ${g.transaction_type} | ${g.product_name} | Qty: ${g.quantity_out || g.quantity_in}`);
    });

    // DELETE THEM
    const delStmt = db.prepare(`
        DELETE FROM stock_ledger 
        WHERE id = ?
    `);

    const transaction = db.transaction(() => {
        for (const g of ghosts) {
            delStmt.run(g.id);
        }
    });
    transaction();
    console.log("\n✅ CLEANUP COMPLETE: All orphans deleted.");
}
