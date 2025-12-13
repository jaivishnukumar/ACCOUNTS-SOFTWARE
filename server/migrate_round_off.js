const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'sales_app.db');
const db = new Database(dbPath);

try {
    console.log("Checking if 'round_off' column exists in 'sales' table...");

    // Check if column exists
    const tableInfo = db.prepare("PRAGMA table_info(sales)").all();
    const roundOffExists = tableInfo.some(col => col.name === 'round_off');

    if (!roundOffExists) {
        console.log("Adding 'round_off' column...");
        db.prepare("ALTER TABLE sales ADD COLUMN round_off REAL DEFAULT 0").run();
        console.log("Migration successful: 'round_off' column added.");
    } else {
        console.log("'round_off' column already exists. No changes made.");
    }

} catch (error) {
    console.error("Migration failed:", error);
} finally {
    db.close();
}
