const Database = require('better-sqlite3');
const path = require('path');

// Connect to Database
const dbPath = path.resolve(__dirname, 'sales_app.db'); // Correct DB Name
const db = new Database(dbPath);

console.log(`Connected to database at ${dbPath}`);

try {
    const purchases = db.prepare('SELECT * FROM purchases').all();
    console.log(`Found ${purchases.length} purchases to fix.`);

    const updateStmt = db.prepare(`
        UPDATE purchases 
        SET bill_value = ?, round_off = ? 
        WHERE id = ?
    `);

    let fixedCount = 0;

    const transaction = db.transaction(() => {
        for (const p of purchases) {
            // Formula: Taxable + CGST + SGST (No Expenses)
            const rawTotal = (p.taxable_value || 0) + (p.cgst || 0) + (p.sgst || 0);

            // Round to nearest integer
            const newBillValue = Math.round(rawTotal);

            // Calculate Round Off Difference
            const roundOff = newBillValue - rawTotal;

            // Only update if changes are significant (float precision check)
            if (Math.abs(newBillValue - p.bill_value) > 0.01 || Math.abs(roundOff - (p.round_off || 0)) > 0.01) {
                console.log(`Fixing ID ${p.id}: Old Bill: ${p.bill_value} -> New Bill: ${newBillValue.toFixed(2)} (R.O: ${roundOff.toFixed(2)})`);
                updateStmt.run(newBillValue, roundOff, p.id);
                fixedCount++;
            }
        }
    });

    transaction();
    console.log(`Successfully updated ${fixedCount} purchase entries.`);

} catch (error) {
    console.error("Error fixing bill values:", error);
} finally {
    db.close();
}
