const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'sales_app.db');
const db = new Database(dbPath);

try {
    console.log("Checking if 'product_name' column exists in 'sales' table...");

    // Check if column exists
    const tableInfo = db.prepare("PRAGMA table_info(sales)").all();
    const columnExists = tableInfo.some(col => col.name === 'product_name');

    if (!columnExists) {
        console.log("Adding 'product_name' column...");
        db.prepare("ALTER TABLE sales ADD COLUMN product_name TEXT").run();
        console.log("Migration successful: 'product_name' column added.");
    } else {
        console.log("'product_name' column already exists. No changes made.");
    }

} catch (error) {
    console.error("Migration failed:", error);
} finally {
    db.close();
}
