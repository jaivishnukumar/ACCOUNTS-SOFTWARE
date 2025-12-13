const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'sales_app.db');
const db = new Database(dbPath);

console.log('Migrating HSN Codes to Products...');

try {
    // 1. Ensure 'packing_type' column exists (JIC server update didn't run)
    try {
        db.exec("ALTER TABLE products ADD COLUMN packing_type TEXT DEFAULT 'BAG'");
        console.log("Added 'packing_type' column.");
    } catch (e) {
        // Column likely exists
    }

    // 2. Fetch HSN Codes
    const hsnCodes = db.prepare('SELECT * FROM hsn_codes').all();
    console.log(`Found ${hsnCodes.length} HSN codes.`);

    const insert = db.prepare('INSERT INTO products (company_id, name, hsn_code, tax_rate, packing_type) VALUES (?, ?, ?, ?, ?)');

    let migrated = 0;
    const transaction = db.transaction((codes) => {
        for (const hsn of codes) {
            // Check if exists
            const exists = db.prepare('SELECT 1 FROM products WHERE hsn_code = ?').get(hsn.code);
            if (!exists) {
                const name = hsn.description || `Product ${hsn.code}`;
                insert.run(hsn.company_id, name, hsn.code, hsn.rate, 'BAG');
                migrated++;
            }
        }
    });

    transaction(hsnCodes);
    console.log(`Successfully migrated ${migrated} products.`);

} catch (e) {
    console.error('Migration failed:', e);
    const fs = require('fs');
    fs.writeFileSync('migration_error.txt', JSON.stringify(e, Object.getOwnPropertyNames(e)));
}
