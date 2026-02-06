const Database = require('better-sqlite3');
const fs = require('fs');

const file = 'database.sqlite';
if (fs.existsSync(file)) {
    console.log(`\n--- Checking ${file} ---`);
    try {
        const db = new Database(file, { readonly: true });
        const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
        console.log(`Tables: ${tables.length}`);
        tables.forEach(t => {
            const count = db.prepare(`SELECT COUNT(*) as c FROM ${t.name}`).get().c;
            console.log(`  ${t.name}: ${count}`);
        });
    } catch (e) {
        console.log("Error:", e.message);
    }
} else {
    console.log("File not found");
}
