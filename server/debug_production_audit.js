const db = require('better-sqlite3')('sales_app.db');

try {
    const productions = db.prepare(`
        SELECT sl.id, sl.date, sl.product_id, p.name as product_name, sl.quantity_in, sl.related_id, p.formula_base_qty
        FROM stock_ledger sl
        JOIN products p ON sl.product_id = p.id
        WHERE sl.transaction_type = 'PRODUCTION'
        ORDER BY sl.id DESC
        LIMIT 5
    `).all();

    const results = [];

    for (const prod of productions) {
        const ingredients = db.prepare(`
            SELECT sl.product_id, p.name, sl.quantity_out, sl.trans_unit
            FROM stock_ledger sl
            JOIN products p ON sl.product_id = p.id
            WHERE sl.related_id = ? AND sl.transaction_type = 'CONSUMPTION'
        `).all(prod.related_id);

        const formula = db.prepare(`
            SELECT pf.quantity, p.name, p.packing_type
            FROM product_formulas pf
            JOIN products p ON pf.ingredient_id = p.id
            WHERE pf.product_id = ?
        `).all(prod.product_id);

        results.push({
            production: prod,
            ingredients: ingredients,
            formula: formula.map(f => ({
                name: f.name,
                qty_per_1_unit: f.quantity,
                expected_consumed: prod.quantity_in * f.quantity
            }))
        });
    }

    console.log(JSON.stringify(results, null, 2));
} catch (e) {
    console.error(e);
}
