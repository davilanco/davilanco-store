export async function onRequestGet(context) {
  const { env } = context;
  const steps = [];

  const alters = [
    "ALTER TABLE products ADD COLUMN ae_product_id TEXT",
    "ALTER TABLE products ADD COLUMN ae_sku_attr TEXT",
    "ALTER TABLE orders ADD COLUMN ae_order_id TEXT",
    "ALTER TABLE orders ADD COLUMN tracking_number TEXT",
    "ALTER TABLE orders ADD COLUMN tracking_carrier TEXT",
    "ALTER TABLE orders ADD COLUMN ae_status TEXT"
  ];

  for (let i = 0; i < alters.length; i++) {
    try {
      await env.DB.prepare(alters[i]).run();
      steps.push({ sql: alters[i], status: 'ok' });
    } catch (e) {
      steps.push({ sql: alters[i], status: 'skipped', reason: e.message });
    }
  }

  return Response.json({ ok: true, steps: steps });
}
