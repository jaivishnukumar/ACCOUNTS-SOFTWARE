const db = require('better-sqlite3')('sales_app.db');

console.log("--- TRACING LAST CONSUMPTION ENTRY FOR PVA ---");

// 1. Find PVA Product
const pva = db.prepare("SELECT * FROM products WHERE name LIKE '%PVA%'").get();
if (!pva) { console.log("PVA not found"); process.exit(1); }

console.log(`Ingredient: ${pva.name} (ID: ${pva.id})`);

// 2. Find Last Consumption Entry
const ledgerEntry = db.prepare(`
    SELECT * FROM stock_ledger 
    WHERE product_id = ? AND transaction_type = 'CONSUMPTION' 
    ORDER BY id DESC LIMIT 1
`).get(pva.id);

if (!ledgerEntry) {
    console.log("No CONSUMPTION entry found for PVA.");
} else {
    console.log("\n--- LEDGER ENTRY ---");
    console.table([ledgerEntry]);

    // 3. Find Related Sale
    // Note: In the auto-production logic, related_id is the Sale ID.
    const sale = db.prepare("SELECT * FROM sales WHERE id = ?").get(ledgerEntry.related_id);

    if (sale) {
        console.log("\n--- TRIGGERED BY SALE ---");
        console.log(`Sale ID: ${sale.id}`);
        console.log(`Invoice: ${sale.bill_no}`);
        console.log(`Date: ${sale.date}`);

        // 4. Identify Finished Good
        const finishedGood = db.prepare("SELECT * FROM products WHERE id = ?").get(sale.product_id);
        console.log(`Sold Product (Finished Good): ${finishedGood.name} (ID: ${finishedGood.id})`);
        console.log(`Sold Qty: ${sale.bags} Bags`);

        // 5. Check Formula
        const formula = db.prepare(`
            SELECT * FROM product_formulas 
            WHERE product_id = ? AND ingredient_id = ?
        `).get(finishedGood.id, pva.id);

        console.log("\n--- FORMULA ---");
        if (formula) {
            console.log(`For 1 Unit of ${finishedGood.name}, Formula requires:`);
            console.log(`  - ${formula.quantity} ${formula.unit_type === 'secondary' ? pva.secondary_unit : pva.packing_type} of ${pva.name}`);
            console.log(`Formula Unit Type: ${formula.unit_type}`);
        } else {
            console.log("No direct formula found linking these products.");
        }

    } else {
        console.log("Could not find related Sale.");
        // Check if it was a manual production?
        const prod = db.prepare("SELECT * FROM production_logs WHERE id = ?").get(ledgerEntry.related_id);
        if (prod) {
            console.log("Wait, related_id matched a Production Log!");
            console.log(prod);
        }
    }
}
