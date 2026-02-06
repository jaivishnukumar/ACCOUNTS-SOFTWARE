const Database = require('better-sqlite3');
const db = new Database('sales_app.db');

const rows = db.prepare(`
    SELECT 
        sl.id,
        sl.date,
        sl.transaction_type,
        sl.quantity_in,
        sl.quantity_out,
        sl.trans_unit,
        sl.trans_conversion_factor,
        p.name as product_name,
        p.packing_type as prim_unit,
        p.secondary_unit as sec_unit,
        p.conversion_rate as prod_rate,
        p.has_dual_units
    FROM stock_ledger sl
    JOIN products p ON sl.product_id = p.id
    WHERE p.has_dual_units = 1
    ORDER BY sl.id DESC
    LIMIT 20
`).all();

console.log("--- Stock Ledger Dump (Dual Unit Products) ---");
rows.forEach(r => {
    console.log(`ID: ${r.id} | Type: ${r.transaction_type} | Date: ${r.date}`);
    console.log(`  Prod: ${r.product_name} (Prim: ${r.prim_unit}, Sec: ${r.sec_unit}, Rate: ${r.prod_rate})`);
    console.log(`  QtyIn (Base): ${r.quantity_in} | QtyOut (Base): ${r.quantity_out}`);
    console.log(`  TransUnit: ${r.trans_unit} | TransFactor: ${r.trans_conversion_factor}`);
    console.log("------------------------------------------------");
});
