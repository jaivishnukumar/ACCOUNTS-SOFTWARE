const smallUnits = ['KG', 'KGS', 'KILOGRAM', 'GM', 'GRAM', 'GMS', 'LTR', 'LITER', 'ML'];
const ingredient_unit = 'BAG'; // Primary Unit of PVA
const isIngDecimal = smallUnits.some(u => ingredient_unit.includes(u));

console.log(`Unit: ${ingredient_unit}`);
console.log(`Is Decimal Allowed? ${isIngDecimal}`);

// Scenario: 4 Units * 6 Kgs = 24 Kgs.
// 24 Kgs / 20 Rate = 1.2 Bags.
const calculatedQty = 1.2;

let finalQty = calculatedQty;
if (!isIngDecimal) {
    console.log("Rounding logic applies (Math.ceil)");
    finalQty = Math.ceil(calculatedQty);
}

console.log(`Calculated: ${calculatedQty}`);
console.log(`Final Stored: ${finalQty}`);
console.log(`Final KGS: ${finalQty * 20}`);
