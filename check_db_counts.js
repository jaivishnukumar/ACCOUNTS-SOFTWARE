const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const files = [
    'sales_app.db',
    'server/sales_app.db',
    'server/database.sqlite'
];

files.forEach(file => {
    if (fs.existsSync(file)) {
        console.log(`\n--- Checking ${file} ---`);
        try {
            const db = new Database(file, { readonly: true });
            const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();

            if (tables.length === 0) {
                console.log("  (No tables found)");
            } else {
                tables.forEach(t => {
                    try {
                        const count = db.prepare(`SELECT COUNT(*) as c FROM ${t.name}`).get().c;
                        console.log(`  ${t.name}: ${count}`);
                    } catch (e) {
                        console.log(`  ${t.name}: Error reading (${e.message})`);
                    }
                });
            }
        } catch (e) {
            console.log("  Error opening DB:", e.message);
        }
    } else {
        console.log(`\n--- ${file} (NOT FOUND) ---`);
    }
});
