const db = require('better-sqlite3')('sales_app.db');
const products = db.prepare("SELECT id, name, packing_type FROM products LIMIT 5").all();
console.table(products);
