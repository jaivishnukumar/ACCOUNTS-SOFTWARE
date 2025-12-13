const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'sales_app.db');
const db = new Database(dbPath);

try {
    console.log("Checking if 'unit' column exists in 'sales' table...");

    // Check if column exists
    const tableInfo = db.prepare("PRAGMA table_info(sales)").all();
    const columnExists = tableInfo.some(col => col.name === 'unit');

    if (!columnExists) {
        console.log("Adding 'unit' column...");
        db.prepare("ALTER TABLE sales ADD COLUMN unit TEXT").run();
        console.log("Migration successful: 'unit' column added.");
    } else {
        console.log("'unit' column already exists. No changes made.");
    }

} catch (error) {
    console.error("Migration failed:", error);
} finally {
    db.close();
}
