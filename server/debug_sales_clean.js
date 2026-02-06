const db = require('better-sqlite3')('sales_app.db');

try {
    const row = db.prepare(`
      SELECT s.*, p.name as party_name, p.gst_number, pr.name as product_name, pr.packing_type as product_unit
      FROM sales s 
      LEFT JOIN parties p ON s.party_id = p.id
      LEFT JOIN products pr ON s.product_id = pr.id
      WHERE s.company_id = ?
      LIMIT 1
    `).get('1');

    console.log(JSON.stringify(row, null, 2));
} catch (e) {
    console.error(e);
}
