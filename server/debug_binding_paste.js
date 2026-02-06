const db = require('better-sqlite3')('sales_app.db');

try {
    console.log("Searching for 'Binding Paste'...");
    const products = db.prepare("SELECT * FROM products WHERE name LIKE '%Binding Paste%'").all();
    console.table(products);

    if (products.length > 0) {
        const pid = products[0].id; // Assuming first match
        console.log(`\nChecking Stock Ledger for Product ID: ${pid}`);

        // Get last 10 entries
        const ledger = db.prepare(`
            SELECT * FROM stock_ledger 
            WHERE product_id = ? 
            ORDER BY id DESC 
            LIMIT 10
        `).all(pid);
        console.log(JSON.stringify(ledger, null, 2));

        // Check for specific "Sales" related entries that might be misclassified
        // If Binding Paste is an ingredient (Raw Material), it should be CONSUMED (Out).
        // If it shows as RECEIVED (In) from a Sale -> That's the bug.
    }
} catch (e) {
    console.error(e);
}
