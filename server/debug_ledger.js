const db = require('better-sqlite3')('sales_app.db');

try {
    console.log("=== Products ===");
    const products = db.prepare("SELECT * FROM products LIMIT 5").all();
    console.table(products);

    if (products.length > 0) {
        // Find a product that likely has activity
        const pid = products[0].id;
        console.log(`\n=== Stock Ledger for Product ID ${pid} (${products[0].name}) ===`);

        // Check Opening
        const openings = db.prepare("SELECT * FROM stock_ledger WHERE product_id = ? AND transaction_type = 'OPENING'").all(pid);
        console.log("Opening Entries:", openings);

        // Check Sales
        const sales = db.prepare("SELECT * FROM stock_ledger WHERE product_id = ? AND transaction_type = 'SALE' LIMIT 5").all(pid);
        console.log("Sales Entries (First 5):", sales);

        // Check All Ledger for this product
        const all = db.prepare("SELECT id, date, transaction_type, quantity_in, quantity_out FROM stock_ledger WHERE product_id = ? ORDER BY date ASC LIMIT 10").all(pid);
        console.table(all);

        // Count total Sales vs Sales in Ledger
        const totalSales = db.prepare("SELECT count(*) as c FROM sales WHERE product_id = ?").get(pid).c;
        const totalLedgerSales = db.prepare("SELECT count(*) as c FROM stock_ledger WHERE product_id = ? AND transaction_type = 'SALE'").get(pid).c;
        console.log(`\nIntegrity Check: Total Sales Table Rows: ${totalSales} | Total Ledger Sale Rows: ${totalLedgerSales}`);

    } else {
        console.log("No products found.");
    }

} catch (e) {
    console.error(e);
}
