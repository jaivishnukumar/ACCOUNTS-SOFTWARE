const db = require('better-sqlite3')('sales_app.db');

console.log("--- DEBUG: LAST 5 STOCK LEDGER ENTRIES FOR PVA ---");

// 1. Find the PVA Product ID (using loose match)
const pva = db.prepare("SELECT * FROM products WHERE name LIKE '%PVA%'").get();

if (!pva) {
    console.log("Product 'PVA' not found!");
} else {
    console.log("PVA Product:", pva);

    // 2. Dump Ledger
    const rows = db.prepare(`
        SELECT id, date, transaction_type, quantity_in, quantity_out, trans_unit, trans_conversion_factor, related_id 
        FROM stock_ledger 
        WHERE product_id = ? 
        ORDER BY id DESC 
        LIMIT 5
    `).all(pva.id);

    console.table(rows);

    // 3. If there is a Production Out, find the related Production Log
    const prodRow = rows.find(r => r.transaction_type === 'PRODUCTION_OUT');
    if (prodRow) {
        console.log("\n--- RELATED PRODUCTION LOG ---");
        const prodLog = db.prepare("SELECT * FROM production_logs WHERE id = ?").get(prodRow.related_id);
        console.log(prodLog);

        if (prodLog) {
            console.log("\n--- FORMULA CONSISTENCY CHECK ---");
            // Check Formula for this output product + input ingredient
            const formula = db.prepare(`
                SELECT * FROM product_formulas 
                WHERE product_id = ? AND ingredient_id = ?
            `).get(prodLog.output_product_id, pva.id);
            console.log("Formula Definition:", formula);

            console.log("\n--- CALCULATION ---");
            console.log(`Output Quantity: ${prodLog.output_quantity}`);
            if (formula) {
                console.log(`Formula Qty per Unit: ${formula.quantity} (${formula.unit_type})`);
                console.log(`Expected Total Consumption: ${prodLog.output_quantity} * ${formula.quantity} = ${prodLog.output_quantity * formula.quantity}`);
                console.log(`Actual Ledger Deduction (Base Units): ${prodRow.quantity_out}`);
                console.log(`PVA Conv Rate: ${pva.conversion_rate} (${pva.secondary_unit}/${pva.packing_type})`);

                const converted = prodRow.quantity_out * pva.conversion_rate;
                console.log(`Ledger Deduction (Converted to Secondary): ${converted}`);
            } else {
                console.log("No Formula found connecting these products.");
            }
        }
    }
}
