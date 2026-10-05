export async function onRequestGet(context) {
  const { env } = context;

  try {
    const columns = [
      'ALTER TABLE users ADD COLUMN verified INTEGER DEFAULT 0',
      'ALTER TABLE users ADD COLUMN verify_code TEXT',
      'ALTER TABLE users ADD COLUMN verify_expires TEXT'
    ];

    const results = [];

    for (let i = 0; i < columns.length; i++) {
      try {
        await env.DB.prepare(columns[i]).run();
        results.push({ sql: columns[i], status: 'added' });
      } catch (err) {
        results.push({
          sql: columns[i],
          status: 'skipped',
          reason: err.message
        });
      }
    }

    return Response.json({
      ok: true,
      message: 'Users verification columns checked/updated',
      details: results
    });
  } catch (err) {
    return Response.json({
      ok: false,
      error: err.message
    }, { status: 500 });
  }
}
