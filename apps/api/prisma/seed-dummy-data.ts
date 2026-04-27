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

  console.log('Inserting dummy products and orders for KPIs...');

  // Create products
  const productIds = [];
  for (let i = 1; i <= 5; i++) {
    const id = `prod-${i}`;
    productIds.push(id);
    await pool.query(
      `INSERT INTO products (id, tenant_id, title, status, created_at, updated_at)
       VALUES ($1, $2, $3, 'active', NOW(), NOW())
       ON CONFLICT (id) DO NOTHING`,
      [id, tenantId, `Örnek Trendyol Ürünü ${i}`]
    );
  }

  // Create orders
  for (let i = 1; i <= 20; i++) {
    const orderId = `order-${i}`;
    const amount = Math.floor(Math.random() * 500) + 100;
    // Random date in the last 30 days
    const orderDate = new Date();
    orderDate.setDate(orderDate.getDate() - Math.floor(Math.random() * 30));

    await pool.query(
      `INSERT INTO orders (id, tenant_id, trendyol_order_number, status, total_price, order_date, created_at, updated_at)
       VALUES ($1, $2, $3, 'Delivered', $4, $5, NOW(), NOW())
       ON CONFLICT (id) DO NOTHING`,
      [orderId, tenantId, `ORD${i}000`, amount, orderDate]
    );

    // Create order item
    const productId = productIds[Math.floor(Math.random() * productIds.length)];
    await pool.query(
      `INSERT INTO order_items (id, order_id, product_id, quantity, unit_price, amount)
       VALUES (gen_random_uuid(), $1, $2, 1, $3, $3)`,
      [orderId, productId, amount]
    );
  }

  console.log('Dummy data inserted!');
  await pool.end();
}

main().catch(console.error);