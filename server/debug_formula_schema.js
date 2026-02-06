const db = require('better-sqlite3')('sales_app.db');
const info = db.pragma("table_info(product_formulas)");
console.table(info);
