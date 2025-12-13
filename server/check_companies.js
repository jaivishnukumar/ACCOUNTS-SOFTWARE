const Database = require('better-sqlite3');
const db = new Database('sales_app.db');

try {
    const companies = db.prepare("SELECT * FROM companies").all();
    console.log("Companies:", companies);
} catch (error) {
    console.error("Error:", error.message);
}
