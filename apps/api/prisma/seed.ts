import * as bcrypt from 'bcrypt';
import pg from 'pg';
import { encrypt } from '../src/common/crypto.util';

/**
 * Seed Script — uses raw pg driver (bypasses Prisma engine P1010 bug)
 * Uses actual PostgreSQL column names (snake_case)
 */
async function main() {
  const pool = new pg.Pool({
    connectionString:
      process.env.DATABASE_URL ||
      'postgresql://zmkuser:zmkpass@localhost:5433/zmktrendyol',
  });

  console.log('🌱 Seeding ZMK Trendyol Platform...\n');

  // ─── 1. Create Tenant ──────────────────────────
  const tenantId = 'zmk-default-tenant';
  await pool.query(
    `INSERT INTO tenants (id, name, created_at, updated_at) 
     VALUES ($1, $2, NOW(), NOW()) 
     ON CONFLICT (id) DO UPDATE SET name = $2, updated_at = NOW()`,
    [tenantId, 'ZMK Agency'],
  );
  console.log('✅ Tenant: ZMK Agency');

  // ─── 2. Create Admin User ─────────────────────
  const passwordHash = await bcrypt.hash('ZmK2026!Admin', 12);
  await pool.query(
    `INSERT INTO users (id, email, password_hash, name, role, tenant_id, is_active, created_at, updated_at) 
     VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, true, NOW(), NOW())
     ON CONFLICT (email) DO UPDATE SET password_hash = $2, updated_at = NOW()`,
    ['admin@zmkagency.com', passwordHash, 'Zümer K', 'owner', tenantId],
  );
  console.log('✅ User: admin@zmkagency.com (password hash updated)');

  // ─── 3. Create Trendyol Seller Connection ─────
  const apiKey = process.env.TRENDYOL_API_KEY || 'xBX5OAFpPcsTj1uXkDGx';
  const apiSecret = process.env.TRENDYOL_API_SECRET || 'OaWlNeYgJLXVa8zcS2RT';
  const sellerId = process.env.TRENDYOL_SELLER_ID || '571676';

  await pool.query(
    `INSERT INTO seller_connections (id, tenant_id, seller_id, api_key_ref, api_secret_ref, status, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, 'active', NOW(), NOW())
     ON CONFLICT (id) DO UPDATE SET api_key_ref = $4, api_secret_ref = $5, status = 'active', updated_at = NOW()`,
    ['zmk-trendyol-connection', tenantId, sellerId, encrypt(apiKey), encrypt(apiSecret)],
  );
  console.log(`✅ Seller Connection: Trendyol #${sellerId}`);

  // ─── 4. Create Alert Rules ────────────────────
  const alertRules = [
    { id: 'rule-buybox-lost', type: 'buybox_lost', conditions: { severity: 'critical', channel: 'telegram', label: 'Buybox Kaybedildi' } },
    { id: 'rule-stock-low', type: 'stock_below_threshold', conditions: { severity: 'warning', channel: 'telegram', label: 'Düşük Stok Uyarısı', threshold: 10 } },
    { id: 'rule-price-war', type: 'competitor_price_drop', conditions: { severity: 'critical', channel: 'telegram', label: 'Fiyat Savaşı Algılandı', dropPercent: 15 } },
    { id: 'rule-order-spike', type: 'order_spike', conditions: { severity: 'info', channel: 'dashboard', label: 'Sipariş Patlaması', spikePercent: 200 } },
  ];

  for (const rule of alertRules) {
    await pool.query(
      `INSERT INTO alert_rules (id, tenant_id, type, conditions, is_active)
       VALUES ($1, $2, $3, $4, true)
       ON CONFLICT (id) DO NOTHING`,
      [rule.id, tenantId, rule.type, JSON.stringify(rule.conditions)],
    );
  }
  console.log(`✅ Alert Rules: ${alertRules.length} kural`);

  // ─── 5. Create OOS Sniper Automation Rule ─────
  await pool.query(
    `INSERT INTO automation_rules (id, tenant_id, name, trigger_type, conditions, action_type, "actionData", is_active, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, true, NOW(), NOW())
     ON CONFLICT (id) DO NOTHING`,
    [
      'rule-oos-sniper',
      tenantId,
      'OOS Sniper — Rakip Stok Bitince Fiyat Artır',
      'COMPETITOR_OOS',
      JSON.stringify({ operator: 'eq', threshold: 0, field: 'competitor_stock' }),
      'PRICE_BUMP',
      JSON.stringify({ bumpPercentage: 25 }),
    ],
  );
  console.log('✅ Automation Rule: OOS Sniper');

  // ─── Summary ──────────────────────────────────
  console.log('\n🎉 Seed tamamlandı!');
  console.log('─────────────────────────────────────');
  console.log('  Email:    admin@zmkagency.com');
  console.log('  Şifre:    ZmK2026!Admin');
  console.log(`  Seller:   ${sellerId}`);
  console.log('─────────────────────────────────────');

  await pool.end();
}

main().catch((e) => {
  console.error('❌ Seed hatası:', e);
  process.exit(1);
});
