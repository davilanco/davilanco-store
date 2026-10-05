export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const cloudName = env.CLOUDINARY_CLOUD_NAME;
    const preset = env.CLOUDINARY_UPLOAD_PRESET || 'davilanco_products';

    if (!cloudName) {
      return Response.json({
        error: 'CLOUDINARY_CLOUD_NAME is not set'
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

    const type = file.type || '';
    if (!type.startsWith('image/')) {
      return Response.json({ error: 'Only image files allowed' }, { status: 400 });
    }

    if (file.size > 5 * 1024 * 1024) {
      return Response.json({ error: 'File too large (max 5MB)' }, { status: 400 });
    }

    const out = new FormData();
    out.append('file', file);
    out.append('upload_preset', preset);
    out.append('folder', 'davilanco/products');

    const cloudRes = await fetch(
      'https://api.cloudinary.com/v1_1/' + cloudName + '/image/upload',
      {
        method: 'POST',
        body: out
      }
    );

    const data = await cloudRes.json();

    if (!cloudRes.ok || !data.secure_url) {
      return Response.json({
        error: data.error && data.error.message ? data.error.message : 'Cloudinary upload failed'
      }, { status: 500 });
    }

    return Response.json({
      ok: true,
      url: data.secure_url,
      public_id: data.public_id
    });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
