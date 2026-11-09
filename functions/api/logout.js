export async function onRequestPost() {
  const response = Response.json({ ok: true, message: 'Signed out' });
  response.headers.append('Set-Cookie', 'davilanco_session=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax');
  response.headers.set('Cache-Control', 'no-store');
  return response;
}
