const Database = require('better-sqlite3');
const path = require('node:path');
const fs = require('node:fs');

const dbPath = path.join(__dirname, 'sales_app.db');
const db = new Database(dbPath);
const outPath = path.join(__dirname, 'debug_output.txt');

const log = (msg) => fs.appendFileSync(outPath, msg + '\n');

fs.writeFileSync(outPath, "--- DEBUG LEDGER DATA ---\n");

try {
    const rows = db.prepare(`
        SELECT 
            p.id, 
            p.name, 
            p.packing_type, 
            p.has_dual_units, 
            p.secondary_unit, 
            p.conversion_rate,
            COUNT(sl.id) as ledger_entries
        FROM products p
        JOIN stock_ledger sl ON p.id = sl.product_id
        GROUP BY p.id
    `).all();

    log(`Found ${rows.length} products with ledger entries.`);

    rows.forEach(r => {
        log(`\nProduct: ${r.name} (ID: ${r.id})`);
        log(`  Packing: ${r.packing_type}`);
        log(`  Dual Units: ${r.has_dual_units} (Type: ${typeof r.has_dual_units})`);
        log(`  Secondary: ${r.secondary_unit}`);
        log(`  Conv Rate: ${r.conversion_rate} (Type: ${typeof r.conversion_rate})`);
        log(`  Entries: ${r.ledger_entries}`);

        if (r.has_dual_units) {
            log(`  -> EXPECTED BEHAVIOR with Mode 'secondary': Divide by ${r.conversion_rate}`);
        } else {
            log(`  -> conversion skipped (evaluates falsy)`);
        }
    });

} catch (e) {
    log("Error: " + e.message);
}
