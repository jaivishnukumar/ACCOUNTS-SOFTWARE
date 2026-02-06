const axios = require('axios');
const db = require('better-sqlite3')('sales_app.db');
const jwt = require('jsonwebtoken');

const API_URL = 'http://localhost:5002/api';
const COMPANY_ID = 1;
const JWT_SECRET = 'your-secret-key'; // From server/index.js default

async function runTest() {
    try {
        console.log("--- 1. AUTHENTICATING (Manual) ---");
        const token = jwt.sign(
            { id: 1, role: 'admin', allowed_years: 'all' },
            JWT_SECRET,
            { expiresIn: '1h' }
        );
        console.log("Generated Token.");

        console.log("\n--- 2. PREPARING DATA ---");
        const gum = db.prepare("SELECT * FROM products WHERE name LIKE '%liquid gum - a1%'").get();
        if (!gum) { console.log("Product not found"); process.exit(1); }

        console.log(`Product: ${gum.name} (ID: ${gum.id})`);

        const payload = {
            date: new Date().toISOString().split('T')[0],
            bill_no: 'TEST-AUTO-' + Date.now(),
            party_id: 1,
            bill_value: 1000,
            bags: 10,
            unit: gum.packing_type,
            conversion_factor: 1,
            hsn_code: '1234',
            tax_rate: 18,
            cgst: 90,
            sgst: 90,
            total: 1180,
            product_id: gum.id
        };

        console.log("\n--- 3. CREATING SALE (POST /api/sales) ---");
        const res = await axios.post(`${API_URL}/sales`, payload, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'company-id': COMPANY_ID,
                'financial-year': '2025-2026'
            }
        });

        console.log(`Sale Created. ID: ${res.data.id}`);

        console.log("\n--- 4. VERIFYING CONSUMPTION ---");
        const entries = db.prepare(`
            SELECT * FROM stock_ledger 
            WHERE related_id = ? AND transaction_type = 'CONSUMPTION'
        `).all(res.data.id);

        if (entries.length === 0) {
            console.log("FAIL: No Consumption Entries Created!");
        } else {
            const totalOut = entries.reduce((acc, e) => acc + e.quantity_out, 0);

            // PVA is dual unit. Ledger stores BASE (Bags).
            // Formula is 6 KGS per Unit.
            // 10 Units * 6 KGS = 60 KGS total.
            // 1 Bag = 20 KGS.
            // So Total Out (Base) should be 3 Bags.

            console.log(`Total Ledger Quantity Out: ${totalOut}`);

            if (totalOut === 3) {
                console.log("✅ TEST PASSED: 3 Bags (=60 Kgs) consumed.");
            } else if (totalOut > 100) {
                console.log(`❌ TEST FAILED: ${totalOut} consumed (Likely ${totalOut * 20} KGS).`);
            } else {
                console.log(`❓ TEST AMBIGUOUS: Check values manually.`);
            }
        }

    } catch (error) {
        console.error("Test Failed:", error.message);
        if (error.response) console.error("API Response:", error.response.data);
    }
}

runTest();
