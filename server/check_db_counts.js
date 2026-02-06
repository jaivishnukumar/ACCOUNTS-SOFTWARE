const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const files = [
    '../sales_app.db',
    'sales_app.db',
    'database.sqlite'
];

files.forEach(file => {
    const fullPath = path.resolve(file);
    if (fs.existsSync(fullPath)) {
        console.log(`\n--- Checking ${file} ---`);
        try {
            const db = new Database(fullPath, { readonly: true });
            const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();

            if (tables.length === 0) {
                console.log("  (No tables found)");
            } else {
                tables.forEach(t => {
                    if (t.name === 'sqlite_sequence') return;
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
