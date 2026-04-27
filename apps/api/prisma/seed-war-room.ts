import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.join(__dirname, '../.env') });
import pg from 'pg';

async function main() {
  const pool = new pg.Pool({
    connectionString:
      process.env.DATABASE_URL ||
      'postgresql://zmkuser:zmkpass@localhost:5433/zmktrendyol',
  });

  const tenantId = 'zmk-default-tenant';

  console.log('Inserting dummy competitors, snapshots and war room entries...');

  // Add competitor products
  for (let i = 1; i <= 3; i++) {
    const compId = `comp-${i}`;
    await pool.query(
      `INSERT INTO competitor_products (id, tenant_id, trendyol_url, title, brand, tracked_since)
       VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT (id) DO NOTHING`,
      [compId, tenantId, `https://www.trendyol.com/brand/product-${i}`, `Rakip Ürün ${i}`, `Rakip Marka ${i}`]
    );

    // Add snapshots
    for (let j = 0; j < 5; j++) {
      const snapDate = new Date();
      snapDate.setDate(snapDate.getDate() - j);
      await pool.query(
        `INSERT INTO competitor_snapshots (id, competitor_product_id, price, rating, review_count, in_stock, time)
         VALUES (gen_random_uuid(), $1, $2, 4.5, $3, true, $4)`,
        [compId, 100 + (j * 10), 50 + j, snapDate]
      );
    }
  }

  // Add war room entries
  for (let i = 1; i <= 5; i++) {
    await pool.query(
      `INSERT INTO war_room_entries (id, tenant_id, event_type, impact, title, description, created_at)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, NOW())`,
      [tenantId, i % 2 === 0 ? 'price_drop' : 'stock_out', i % 2 === 0 ? 'high' : 'critical', `Olay ${i}`, `Bu bir örnek war room olayıdır ${i}`]
    );
  }

  console.log('Dummy data inserted!');
  await pool.end();
}

main().catch(console.error);