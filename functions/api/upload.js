export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    if (!env.IMAGES) {
      return Response.json({
        error: 'R2 not bound. Add IMAGES binding in Pages settings.'
      }, { status: 500 });
    }

    const contentType = request.headers.get('content-type') || '';
    if (!contentType.includes('multipart/form-data')) {
      return Response.json({
        error: 'Send multipart/form-data with field "file"'
      }, { status: 400 });
    }

    const form = await request.formData();
    const file = form.get('file');

    if (!file || typeof file === 'string') {
      return Response.json({ error: 'No file uploaded' }, { status: 400 });
    }

    // Basic checks
    const type = file.type || 'application/octet-stream';
    if (!type.startsWith('image/')) {
      return Response.json({ error: 'Only image files allowed' }, { status: 400 });
    }

    const maxBytes = 5 * 1024 * 1024; // 5MB
    if (file.size > maxBytes) {
      return Response.json({ error: 'File too large (max 5MB)' }, { status: 400 });
    }

    // Unique key
    const ext = guessExt(type, file.name || '');
    const key = 'products/' + Date.now() + '-' + crypto.randomUUID().slice(0, 8) + ext;

    const bytes = await file.arrayBuffer();

    await env.IMAGES.put(key, bytes, {
      httpMetadata: {
        contentType: type,
        cacheControl: 'public, max-age=31536000'
      }
    });

    const base = (env.R2_PUBLIC_URL || '').replace(/\/$/, '');
    if (!base) {
      return Response.json({
        error: 'R2_PUBLIC_URL env variable not set'
      }, { status: 500 });
    }

    const url = base + '/' + key;

    return Response.json({
      ok: true,
      url: url,
      key: key
    });

  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}

function guessExt(mime, filename) {
  if (filename && filename.indexOf('.') !== -1) {
    var e = filename.slice(filename.lastIndexOf('.')).toLowerCase();
    if (['.jpg', '.jpeg', '.png', '.webp', '.gif'].indexOf(e) !== -1) return e;
  }
  if (mime === 'image/png') return '.png';
  if (mime === 'image/webp') return '.webp';
  if (mime === 'image/gif') return '.gif';
  return '.jpg';
}
