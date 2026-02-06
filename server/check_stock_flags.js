const Database = require('better-sqlite3');
const db = new Database('sales_app.db');

const products = db.prepare('SELECT id, name, maintain_stock, packing_type FROM products').all();
console.table(products);
