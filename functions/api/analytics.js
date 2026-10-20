import { requireAdmin } from '../lib/auth.js';
export async function onRequest(context) {
  const { request, env } = context;
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff'
  };

  try {
    await env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS analytics_events (
        id TEXT PRIMARY KEY,
        event_type TEXT NOT NULL,
        visitor_id TEXT NOT NULL,
        path TEXT NOT NULL,
        page_title TEXT,
        product_id TEXT,
        event_date TEXT NOT NULL,
        created_at TEXT NOT NULL
      )
    `).run();
    await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_analytics_date ON analytics_events(event_date)').run();
    await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_analytics_visitor_date ON analytics_events(event_date, visitor_id)').run();

    if (request.method === 'POST') {
      const body = await request.json();
      const eventType = String(body.event_type || '');
      const visitorId = String(body.visitor_id || '');
      const path = String(body.path || '/');
      if (!['page_view', 'product_view'].includes(eventType) ||
          !/^[a-zA-Z0-9-]{8,100}$/.test(visitorId) ||
          !path.startsWith('/') || path.startsWith('//')) {
        return Response.json({ error: 'Invalid analytics event' }, { status: 400, headers });
      }

      // Use Nigeria local date so the dashboard's daily totals match WAT (UTC+1).
      const eventDate = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Africa/Lagos', year: 'numeric', month: '2-digit', day: '2-digit'
      }).format(new Date());
      await env.DB.prepare(`
        INSERT INTO analytics_events
          (id, event_type, visitor_id, path, page_title, product_id, event_date, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        crypto.randomUUID(),
        eventType,
        visitorId,
        path.slice(0, 300),
        String(body.page_title || '').slice(0, 200),
        String(body.product_id || '').slice(0, 100),
        eventDate,
        new Date().toISOString()
      ).run();
      return Response.json({ ok: true }, { headers });
    }

    if (request.method === 'GET') {
      const auth = await requireAdmin(request, env);
      if (!auth.ok) return auth.response;

      const url = new URL(request.url);
      const days = Math.min(30, Math.max(1, Number(url.searchParams.get('days')) || 7));
      const summary = await env.DB.prepare(`
        SELECT event_date,
          COUNT(*) AS page_views,
          COUNT(DISTINCT visitor_id) AS visitors,
          SUM(CASE WHEN event_type = 'product_view' THEN 1 ELSE 0 END) AS product_views
        FROM analytics_events
        WHERE event_date >= date(?, '-' || ? || ' days')
        GROUP BY event_date
        ORDER BY event_date ASC
      `).bind(
        new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Lagos', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()),
        days - 1
      ).all();

      const today = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Africa/Lagos', year: 'numeric', month: '2-digit', day: '2-digit'
      }).format(new Date());
      const todayRow = await env.DB.prepare(`
        SELECT COUNT(*) AS page_views,
          COUNT(DISTINCT visitor_id) AS visitors,
          SUM(CASE WHEN event_type = 'product_view' THEN 1 ELSE 0 END) AS product_views
        FROM analytics_events WHERE event_date = ?
      `).bind(today).first();

      const popularPages = await env.DB.prepare(`
        SELECT path, COUNT(*) AS views
        FROM analytics_events
        WHERE event_date >= date(?, '-' || ? || ' days')
        GROUP BY path ORDER BY views DESC LIMIT 8
      `).bind(today, days - 1).all();

      return Response.json({
        ok: true,
        days,
        today: todayRow || { page_views: 0, visitors: 0, product_views: 0 },
        daily: summary.results || [],
        popular_pages: popularPages.results || [],
        time_zone: 'Africa/Lagos'
      }, { headers });
    }

    return new Response('Method not allowed', { status: 405, headers });
  } catch (error) {
    return Response.json({ error: 'Analytics service unavailable' }, { status: 500, headers });
  }
}
