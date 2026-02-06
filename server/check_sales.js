const db = require('better-sqlite3')('database.sqlite');
try {
    const count = db.prepare("SELECT count(*) as count FROM stock_ledger WHERE transaction_type = 'SALE'").get();
    console.log('Sale Entries in Ledger:', count);

    const recent = db.prepare("SELECT * FROM stock_ledger WHERE transaction_type = 'SALE' ORDER BY id DESC LIMIT 5").all();
    console.log('Recent Sale Entries:', recent);
} catch (error) {
    console.error(error);
}
