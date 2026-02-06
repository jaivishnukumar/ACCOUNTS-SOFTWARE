const db = require('better-sqlite3')('sales_app.db');
const prod = db.prepare("SELECT id, name FROM products WHERE name LIKE '%liquid gum - a1%'").get();
if (prod) {
    const f = db.prepare("SELECT quantity, unit_type, ingredient_id FROM product_formulas WHERE product_id = ?").get(prod.id);
    if (f) {
        console.log(`QTY:${f.quantity}|UNIT:${f.unit_type}`);
    } else {
        console.log("NO_FORMULA");
    }
} else {
    console.log("PROD_NOT_FOUND");
}
