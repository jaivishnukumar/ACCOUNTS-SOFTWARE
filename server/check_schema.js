const Database = require('better-sqlite3');
const db = new Database('sales_app.db');

try {
    const info = db.prepare("PRAGMA table_info(purchases)").all();
    console.log("Columns in purchases table:");
    info.forEach(col => console.log(col.name));
} catch (error) {
    console.error("Error:", error.message);
}
