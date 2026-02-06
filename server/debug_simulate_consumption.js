// Simulate the consumption logic for 10 units of Liquid Gum - A1
const db = require('better-sqlite3')('sales_app.db');

const productionQty = 10;
const searchTerm = 'liquid gum - a1';

console.log(`--- SIMULATION: PRODUCING ${productionQty} UNITS OF '${searchTerm}' ---`);

const product = db.prepare("SELECT * FROM products WHERE name LIKE ?").get(`%${searchTerm}%`);

if (!product) {
    console.log("Product not found.");
    process.exit(1);
}

// Fetch Formula
const formulas = db.prepare(`
    SELECT pf.quantity, pf.unit_type, p.id as ingredient_id, p.name, p.packing_type, p.secondary_unit, p.conversion_rate
    FROM product_formulas pf
    JOIN products p ON pf.ingredient_id = p.id
    WHERE pf.product_id = ?
`).all(product.id);

console.log(`Found ${formulas.length} ingredients.`);

formulas.forEach(item => {
    console.log(`\nIngredient: ${item.name}`);
    console.log(`Formula Qty: ${item.quantity} (${item.unit_type})`);

    let quantityPerUnit = item.quantity;
    let transUnit = item.packing_type;
    let transConv = 1.0;

    // --- EXACT LOGIC FROM server/index.js (Lines 743-766) ---
    if (item.unit_type === 'secondary' && item.conversion_rate) {
        const pUnit = (item.packing_type || '').toUpperCase();
        const sUnit = (item.secondary_unit || '').toUpperCase();

        const smallUnits = ['KG', 'KGS', 'KILOGRAM', 'GM', 'GRAM', 'GMS', 'LTR', 'LITER', 'ML', 'METER', 'MTR', 'NOS', 'PCS', 'PIECE'];
        const largeUnits = ['BAG', 'BOX', 'PACK', 'PKT', 'DRUM', 'CAN', 'BOTTLE', 'JAR', 'TIN', 'BUNDLE', 'ROLL', 'CRT', 'CARTON'];

        const isSecSmall = smallUnits.some(u => sUnit.includes(u));
        const isPrimLarge = largeUnits.some(u => pUnit.includes(u));

        if (isSecSmall && isPrimLarge) {
            // Sec (Small) -> Base (Large) : DIVIDE
            console.log("LOGIC: Small -> Large (DIVIDE)");
            quantityPerUnit = item.quantity / item.conversion_rate;
        } else if (smallUnits.some(u => pUnit.includes(u)) && largeUnits.some(u => sUnit.includes(u))) {
            // Base (Small) -> Sec (Large) : MULTIPLY
            console.log("LOGIC: Large -> Small (MULTIPLY)");
            quantityPerUnit = item.quantity * item.conversion_rate;
        } else {
            // Default Multiply
            console.log("LOGIC: Default (MULTIPLY)");
            quantityPerUnit = item.quantity * item.conversion_rate;
        }

        transUnit = item.secondary_unit;
        transConv = item.conversion_rate;
    }
    // ---------------------------------------------------------

    let totalRequiredBase = productionQty * quantityPerUnit;
    let totalRequiredSec = totalRequiredBase * transConv; // Just for display if Base is different

    console.log(`Calculated Base Prep Per Unit: ${quantityPerUnit}`);
    console.log(`Total Consumption (Base Units): ${totalRequiredBase} ${item.packing_type}`);

    if (item.unit_type === 'secondary') {
        // Verify math: 10 units * 6 Kgs = 60 Kgs.
        // Script should show:
        // 6 / 20 = 0.3 Bags per unit.
        // 10 * 0.3 = 3 Bags.
        // 3 Bags = 60 Kgs.
        console.log(`Total Consumption (Secondary): ${totalRequiredBase * item.conversion_rate} ${item.secondary_unit}`);
    }
});
