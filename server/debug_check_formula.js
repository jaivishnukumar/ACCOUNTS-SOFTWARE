const db = require('better-sqlite3')('sales_app.db');
// Binding Paste ID is 6 (from previous output)
const pid = 6;
console.log(`Checking formulas for Product ID ${pid}...`);
const formulas = db.prepare("SELECT * FROM product_formulas WHERE product_id = ?").all(pid);
console.log(JSON.stringify(formulas, null, 2));
