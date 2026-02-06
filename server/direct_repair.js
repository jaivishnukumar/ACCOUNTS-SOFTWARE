const Database = require('better-sqlite3');
const db = new Database('sales_app.db'); // Point to correct DB file

console.log('Starting Direct Repair...');
const FIX_YEAR_START = '2024-04-01';

try {
    // 1. Fix Opening Stock
    const openRes = db.prepare(`UPDATE stock_ledger SET date = ? WHERE transaction_type = 'OPENING'`).run(FIX_YEAR_START);
    console.log(`Updated ${openRes.changes} opening entries.`);

    // 2. Missing Sales
    const missingSales = db.prepare(`SELECT s.* FROM sales s LEFT JOIN stock_ledger sl ON sl.related_id = s.id AND sl.transaction_type = 'SALE' WHERE sl.id IS NULL AND s.product_id IS NOT NULL`).all();
    console.log(`Found ${missingSales.length} missing sales.`);
    const insSale = db.prepare(`INSERT INTO stock_ledger (company_id, date, product_id, transaction_type, related_id, quantity_out, quantity_in) VALUES (?, ?, ?, 'SALE', ?, ?, 0)`);

    db.transaction(() => {
        for (const s of missingSales) {
            const qty = (s.bags || 0) * (s.conversion_factor || 1.0);
            insSale.run(s.company_id, s.date, s.product_id, s.id, qty);
        }
    })();

    // 3. Missing Purchases
    const missingPur = db.prepare(`SELECT p.* FROM purchases p LEFT JOIN stock_ledger sl ON sl.related_id = p.id AND sl.transaction_type = 'PURCHASE' WHERE sl.id IS NULL AND p.product_id IS NOT NULL`).all();
    console.log(`Found ${missingPur.length} missing purchases.`);
    const insPur = db.prepare(`INSERT INTO stock_ledger (company_id, date, product_id, transaction_type, related_id, quantity_in, quantity_out) VALUES (?, ?, ?, 'PURCHASE', ?, ?, 0)`);

    db.transaction(() => {
        for (const p of missingPur) {
            const qty = (p.quantity || 0) * (p.conversion_factor || 1.0);
            insPur.run(p.company_id, p.date, p.product_id, p.id, qty);
        }
    })();

    console.log('Repair Done.');
} catch (e) {
    console.error('Error:', e.message);
}
