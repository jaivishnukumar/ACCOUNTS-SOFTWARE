const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'sales_app.db');
console.log("Opening DB at:", dbPath);

const db = new Database(dbPath);

try {
    const companies = db.prepare('SELECT * FROM companies').all();
    console.log("Companies Found:", companies.length);
    if (companies.length > 0) {
        console.table(companies);
    }
} catch (error) {
    console.error("Error reading companies:", error.message);
}
