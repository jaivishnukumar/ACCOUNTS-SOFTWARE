const db = require('better-sqlite3')('sales_app.db');
const info = db.prepare("PRAGMA table_info(sales)").all();
console.table(info);
