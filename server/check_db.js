const Database = require('better-sqlite3');

try {
    const db = new Database('database.sqlite', { verbose: console.log });
    console.log('Connected to DB.');

    console.log('--- checking sales columns ---');
    const cols = db.prepare("PRAGMA table_info(sales)").all();
    console.log('Sales Columns:', cols.map(c => c.name).join(', '));

    console.log('--- checking purchases columns ---');
    const pCols = db.prepare("PRAGMA table_info(purchases)").all();
    console.log('Purchases Columns:', pCols.map(c => c.name).join(', '));

} catch (e) {
    console.error('DB Error:', e);
}
