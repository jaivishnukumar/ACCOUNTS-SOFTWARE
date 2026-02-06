const db = require('better-sqlite3')('sales_app.db');
const pva = db.prepare("SELECT * FROM products WHERE name LIKE '%PVA%'").get();
if (pva) {
    console.log(`ID: ${pva.id}`);
    console.log(`Name: '${pva.name}'`);
    console.log(`Packing Type: '${pva.packing_type}'`); // Check for 'BAG', 'BAGS', etc.
    console.log(`Secondary Unit: '${pva.secondary_unit}'`); // Check for 'KG', 'KGS'
    console.log(`Conversion Rate: ${pva.conversion_rate}`);
    console.log(`Has Dual Units: ${pva.has_dual_units}`);
} else {
    console.log("PVA not found");
}
