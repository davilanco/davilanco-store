// This destructive test/reset route is intentionally disabled in production.
export async function onRequest() {
  return Response.json(
    { error: 'This database reset endpoint is disabled for safety.' },
    { status: 410, headers: { 'Cache-Control': 'no-store' } }
  );
}
