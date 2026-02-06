const Database = require('better-sqlite3');
const db = new Database('database.sqlite');

console.log('Starting Stock Ledger Repair...');

const FIX_YEAR_START = '2024-04-01'; // Defaulting to 2024-2025

// 1. Fix Opening Stock Dates
console.log(`Fixing Opening Stock Dates to ${FIX_YEAR_START}...`);
const openRes = db.prepare(`
    UPDATE stock_ledger
    SET date = ?
    WHERE transaction_type = 'OPENING'
`).run(FIX_YEAR_START);
console.log(`Updated ${openRes.changes} Opening Stock entries.`);


// 2. Backfill Missing Sales
console.log('Backfilling Missing Sales...');
const missingSales = db.prepare(`
    SELECT s.* FROM sales s
    LEFT JOIN stock_ledger sl ON sl.related_id = s.id AND sl.transaction_type = 'SALE'
    WHERE sl.id IS NULL AND s.product_id IS NOT NULL
`).all();

const insertSale = db.prepare(`
    INSERT INTO stock_ledger (company_id, date, product_id, transaction_type, related_id, quantity_out, quantity_in)
    VALUES (?, ?, ?, 'SALE', ?, ?, 0)
`);

db.transaction(() => {
    let count = 0;
    for (const sale of missingSales) {
        // Calculate Quantity (Bags * Conversion if needed, similar to SalesEntry)
        // Note: Logic in index.js uses bags * conversion_factor.
        // We assume valid product_id
        const qty = (sale.bags || 0) * (sale.conversion_factor || 1.0);
        insertSale.run(sale.company_id, sale.date, sale.product_id, sale.id, qty);
        count++;
    }
    console.log(`Backfilled ${count} Sales.`);
})();


// 3. Backfill Missing Purchases
console.log('Backfilling Missing Purchases...');
const missingPurchases = db.prepare(`
    SELECT p.* FROM purchases p
    LEFT JOIN stock_ledger sl ON sl.related_id = p.id AND sl.transaction_type = 'PURCHASE'
    WHERE sl.id IS NULL AND p.product_id IS NOT NULL
`).all();

const insertPurchase = db.prepare(`
    INSERT INTO stock_ledger (company_id, date, product_id, transaction_type, related_id, quantity_in, quantity_out)
    VALUES (?, ?, ?, 'PURCHASE', ?, ?, 0)
`);

db.transaction(() => {
    let count = 0;
    for (const pur of missingPurchases) {
        const qty = (pur.quantity || 0) * (pur.conversion_factor || 1.0);
        insertPurchase.run(pur.company_id, pur.date, pur.product_id, pur.id, qty);
        count++;
    }
    console.log(`Backfilled ${count} Purchases.`);
})();

console.log('Repair Complete.');
