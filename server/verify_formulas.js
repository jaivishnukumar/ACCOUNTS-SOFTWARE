const db = require('better-sqlite3')('sales_app.db');

console.log("--- FORMULA VERIFICATION REPORT ---");

// Get all formulas
const formulas = db.prepare(`
    SELECT pf.id, pf.product_id, pf.ingredient_id, pf.quantity, pf.unit_type,
           p_out.name as output_product, 
           p_in.name as ingredient_name, p_in.packing_type, p_in.secondary_unit, p_in.has_dual_units
    FROM product_formulas pf
    JOIN products p_out ON pf.product_id = p_out.id
    JOIN products p_in ON pf.ingredient_id = p_in.id
    ORDER BY p_out.name
`).all();

if (formulas.length === 0) {
    console.log("No formulas found.");
} else {
    formulas.forEach(f => {
        console.log("-----------------------------------------");
        console.log(`Product:    ${f.output_product}`);
        console.log(`Ingredient: ${f.ingredient_name}`);
        console.log(`Quantity:   ${f.quantity}`);
        console.log(`Unit Type:  ${f.unit_type || 'primary'}`);
        console.log(`Unit Name:  ${(f.unit_type === 'secondary') ? f.secondary_unit : f.packing_type}`);
    });
}
