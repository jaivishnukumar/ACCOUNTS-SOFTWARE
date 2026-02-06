const db = require('better-sqlite3')('sales_app.db');

const idsToDelete = [42, 49]; // 42 was seen in logs, 49 is my test

const delRes = db.prepare(`
    DELETE FROM sales WHERE id IN (${idsToDelete.join(',')})
`).run();

// Cascade delete from ledger manually just in case
const ledgerDel = db.prepare(`
    DELETE FROM stock_ledger 
    WHERE related_id IN (${idsToDelete.join(',')}) 
    AND transaction_type IN ('SALE', 'PRODUCTION', 'CONSUMPTION')
`).run();

console.log(`Deleted Sales: ${delRes.changes}`);
console.log(`Deleted Ledger Entries: ${ledgerDel.changes}`);
