const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'sales_app.db');
console.log(`Reading from: ${dbPath}`);
const db = new Database(dbPath, { readonly: true });

try {
    const companies = db.prepare('SELECT * FROM companies').all();
    console.log("--- COMPANIES ---");
    console.log(JSON.stringify(companies, null, 2));

    const users = db.prepare('SELECT id, username, role, is_approved FROM users').all();
    console.log("\n--- USERS ---");
    console.log(JSON.stringify(users, null, 2));
} catch (e) {
    console.error(e);
}
