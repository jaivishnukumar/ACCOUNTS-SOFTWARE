const db = require('better-sqlite3')('sales_app.db');

// Simulation parameters
const TEST_PRODUCT_ID = 1; // Change if needed to a product with formula
const TEST_QTY = 5;
const COMPANY_ID = 1;

try {
    console.log(`\n=== DEBUG AUTO-PRODUCTION FOR PRODUCT ${TEST_PRODUCT_ID} ===`);

    // 1. Check Formula
    const formula = db.prepare("SELECT * FROM product_formulas WHERE product_id = ?").all(TEST_PRODUCT_ID);
    console.log(`Formula Count: ${formula.length}`);
    if (formula.length === 0) {
        console.log("STOP: No formula found. Auto-production will NOT trigger.");
        process.exit(0);
    }

    // 2. Check Current Stock (Pre-Simulation)
    const stockRes = db.prepare(`
        SELECT COALESCE(SUM(quantity_in) - SUM(quantity_out), 0) as balance 
        FROM stock_ledger 
        WHERE company_id = ? AND product_id = ?
    `).get(COMPANY_ID, TEST_PRODUCT_ID);
    const preStock = stockRes ? stockRes.balance : 0;
    console.log(`Current Stock Balance: ${preStock}`);

    // 3. Simulate Logic
    // In actual code, we INSERT sale first.
    // Post-Sale Stock = PreStock - SaleQty
    const postStock = preStock - TEST_QTY;
    console.log(`Simulated Post-Sale Stock: ${postStock}`);

    // Logic in code: deficit = quantity - currentStock (where currentStock is postStock)
    const deficit = TEST_QTY - postStock;
    console.log(`Calculated Deficit (Code Logic): ${TEST_QTY} - (${postStock}) = ${deficit}`);

    if (deficit > 0) {
        console.log(`SUCCESS: Would produce ${deficit}`);
    } else {
        console.log(`FAILURE: Deficit <= 0. Would NOT produce.`);
    }

    // 4. Correct Logic Check
    const correctDeficit = postStock < 0 ? Math.abs(postStock) : 0;
    console.log(`Correct Deficit Should Be: ${correctDeficit}`);

} catch (e) {
    console.error(e);
}
