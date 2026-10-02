export async function onRequestGet(context) {
  const { env } = context;

  try {
    const columns = [
      "ALTER TABLE messages ADD COLUMN sender_id TEXT",
      "ALTER TABLE messages ADD COLUMN sender_role TEXT",
      "ALTER TABLE messages ADD COLUMN sender_name TEXT",
      "ALTER TABLE messages ADD COLUMN receiver_id TEXT",
      "ALTER TABLE messages ADD COLUMN receiver_role TEXT",
      "ALTER TABLE messages ADD COLUMN message TEXT",
      "ALTER TABLE messages ADD COLUMN is_read INTEGER DEFAULT 0",
      "ALTER TABLE messages ADD COLUMN created_at TEXT"
    ];

    const results = [];

    for (let i = 0; i < columns.length; i++) {
      try {
        await env.DB.prepare(columns[i]).run();
        results.push({ sql: columns[i], status: "added" });
      } catch (err) {
        results.push({
          sql: columns[i],
          status: "skipped",
          reason: err.message
        });
      }
    }

    return Response.json({
      ok: true,
      message: "Messages table columns checked/updated",
      details: results
    });

  } catch (err) {
    return Response.json({
      ok: false,
      error: err.message
    }, { status: 500 });
  }
      }
