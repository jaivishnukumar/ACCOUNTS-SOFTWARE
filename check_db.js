const Database = require('better-sqlite3');
const db = new Database('sales_app.db');

try {
    const companies = db.prepare('SELECT * FROM companies').all();
    console.log('Companies found:', companies);
} catch (error) {
    console.error('Error reading companies:', error.message);
}
