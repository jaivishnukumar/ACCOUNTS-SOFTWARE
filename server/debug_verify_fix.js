const axios = require('axios');
const db = require('better-sqlite3')('sales_app.db');
const jwt = require('jsonwebtoken');

const API_URL = 'http://localhost:5002/api';
const COMPANY_ID = 1;

// 1. Generate Token
const token = jwt.sign({ id: 1, role: 'admin' }, 'your-secret-key', { expiresIn: '1h' });

async function verifyFix() {
    try {
        console.log("--- STARTING SELF-CHECK ---");

        // 2. Identify Products
        const gum = db.prepare("SELECT * FROM products WHERE name LIKE '%liquid gum - a1%'").get();
        if (!gum) throw new Error("Product 'Liquid Gum' not found");
        console.log(`Product: ${gum.name} (ID: ${gum.id})`);

        // 3. Create Sale (4 Units) -> Expect 24 KGS
        // 4 Units * 6 KGS/Unit = 24 KGS.
        // 24 KGS / 20 = 1.2 Bags.
        // OLD BUG: Rounded to 2 Bags = 40 KGS.
        // EXPECTED: 1.2 Bags (stored as 24 KGS equivalent in base if possible, or usually ledger stores BASE unit quantity)
        // Wait, Ledger stores 'quantity_out'.
        // If Trans Unit is 'BAG', and Trans Conv is 1.
        // Correct logic stores: quantity_out = 1.2.

        const payload = {
            date: new Date().toISOString().split('T')[0],
            bill_no: 'CHECK-' + Date.now(),
            party_id: 1,
            bill_value: 400,
            bags: 4, // 4 UNITS
            unit: gum.packing_type,
            conversion_factor: 1,
            total: 472,
            product_id: gum.id
        };

        console.log("Creating Sale for 4 Units...");
        const res = await axios.post(`${API_URL}/sales`, payload, {
            headers: { 'Authorization': `Bearer ${token}`, 'company-id': COMPANY_ID, 'financial-year': '2025-2026' }
        });
        const saleId = res.data.id;
        console.log(`Sale Created ID: ${saleId}`);

        // 4. Inspect Ledger
        const entries = db.prepare(`
            SELECT sl.*, p.name as product_name 
            FROM stock_ledger sl
            JOIN products p ON sl.product_id = p.id
            WHERE sl.related_id = ? AND sl.transaction_type = 'CONSUMPTION'
        `).all(saleId);

        console.log("\n--- LEDGER ENTRIES ---");
        let passed = false;
        entries.forEach(e => {
            console.log(`Item: ${e.product_name} | QtyOut: ${e.quantity_out} | Unit: ${e.trans_unit}`);

            // We look for PVA
            if (e.product_name.includes("PVA")) {
                const kgs = e.quantity_out * 20; // Assuming 1 Bag = 20 Kgs
                console.log(`>> In KGS: ${kgs}`);

                // Allow small float variance
                if (Math.abs(kgs - 24.0) < 0.1) {
                    passed = true;
                }
            }
        });

        if (passed) {
            console.log("\n✅ SUCCESS: Calculated 24 KGS (Correct). Bug Fixed.");
        } else {
            console.log("\n❌ FAILURE: Did not find 24 KGS.");
        }

    } catch (e) {
        console.error("Error:", e.message);
        if (e.response) console.error(e.response.data);
    }
}

verifyFix();
