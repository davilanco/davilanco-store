export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const { login, password } = await request.json();

    if (!login || !password) {
      return Response.json({ error: "Login and password are required" }, { status: 400 });
    }

    // Find user by nickname OR email OR phone
    const user = await env.DB.prepare(`
      SELECT * FROM users 
      WHERE nickname = ? OR email = ? OR phone = ?
    `).bind(login, login, login).first();

    if (!user) {
      return Response.json({ error: "Invalid login or password" }, { status: 401 });
    }

    if (user.status === "suspended") {
      return Response.json({ error: "Your account has been suspended" }, { status: 403 });
    }

    // Verify password
    const isValid = await verifyPassword(password, user.password);
    if (!isValid) {
      return Response.json({ error: "Invalid login or password" }, { status: 401 });
    }

    // Create a simple token (in production you can improve this)
    const token = btoa(JSON.stringify({
      id: user.id,
      nickname: user.nickname,
      role: user.role,
      exp: Date.now() + (7 * 24 * 60 * 60 * 1000) // 7 days
    }));

    // Return safe user data (never return password)
    return Response.json({
      ok: true,
      token,
      user: {
        id: user.id,
        firstname: user.firstname,
        lastname: user.lastname,
        nickname: user.nickname,
        phone: user.phone,
        email: user.email,
        role: user.role
      }
    });

  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}

async function verifyPassword(password, stored) {
  const [saltHex, hashHex] = stored.split(":");
  if (!saltHex || !hashHex) return false;

  const encoder = new TextEncoder();
  const salt = new Uint8Array(saltHex.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
  
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: salt,
      iterations: 100000,
      hash: "SHA-256"
    },
    keyMaterial,
    256
  );
  
  const hashArray = Array.from(new Uint8Array(derivedBits));
  const newHashHex = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
  
  return newHashHex === hashHex;
  }
