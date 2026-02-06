const Database = require('better-sqlite3');
const db = new Database('sales_app.db', { readonly: true });

console.log("--- USERS ---");
console.log(JSON.stringify(db.prepare('SELECT id, username, role, max_companies FROM users').all(), null, 2));

console.log("\n--- COMPANIES ---");
console.log(JSON.stringify(db.prepare('SELECT id, name FROM companies').all(), null, 2));

console.log("\n--- SALES COUNT BY COMPANY ---");
console.log(JSON.stringify(db.prepare('SELECT company_id, COUNT(*) as count FROM sales GROUP BY company_id').all(), null, 2));
