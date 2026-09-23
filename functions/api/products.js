
export async function onRequestGet({ env }) {
  try {
    const result = await env.DB.prepare("SELECT * FROM products LIMIT 10").all();
    return new Response(JSON.stringify(result.results), {
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message, hint: "DB binding missing? Check Settings > Functions > D1 binding = DB" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}


