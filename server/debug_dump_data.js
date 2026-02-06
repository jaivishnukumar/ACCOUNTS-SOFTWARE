const Database = require('better-sqlite3');
const db = new Database('sales_app.db', { readonly: true });

console.log("--- USERS ---");
const users = db.prepare('SELECT * FROM users').all();
console.table(users);

console.log("\n--- COMPANIES ---");
const companies = db.prepare('SELECT * FROM companies').all();
console.table(companies);

console.log("\n--- SALES ---");
const sales = db.prepare('SELECT id, company_id, date, bill_no, total FROM sales').all();
console.table(sales);

console.log("\n--- PARTIES ---");
const parties = db.prepare('SELECT id, company_id, name FROM parties').all();
console.table(parties);
