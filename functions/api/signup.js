export async function onRequestPost(context) {
  const { request, env } = context;

  // Create table if not exists
  await env.DB.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      firstname TEXT NOT NULL,
      lastname TEXT NOT NULL,
      nickname TEXT UNIQUE NOT NULL,
      phone TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT DEFAULT 'customer',
      status TEXT DEFAULT 'active',
      verified INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  try {
    const body = await request.json();
    const { firstname, lastname, nickname, phone, email, password } = body;

    if (!firstname || !lastname || !nickname || !phone || !email || !password) {
      return Response.json({ error: "All fields are required" }, { status: 400 });
    }

    // Strong password validation
    if (
      password.length < 8 ||
      !/[A-Z]/.test(password) ||
      !/[0-9]/.test(password) ||
      !/[^A-Za-z0-9]/.test(password)
    ) {
      return Response.json({
        error: "Password must be at least 8 characters and contain uppercase letter, number and symbol"
      }, { status: 400 });
    }

    const hashedPassword = await hashPassword(password);
    const id = crypto.randomUUID();

    await env.DB.prepare(`
      INSERT INTO users (id, firstname, lastname, nickname, phone, email, password, role)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'customer')
    `).bind(id, firstname.trim(), lastname.trim(), nickname.trim(), phone.trim(), email.trim().toLowerCase(), hashedPassword).run();

    return Response.json({
      ok: true,
      message: "Account created successfully. You can now log in."
    });

  } catch (e) {
    if (e.message.includes("UNIQUE")) {
      return Response.json({ error: "Nickname, phone or email already exists" }, { status: 400 });
    }
    return Response.json({ error: e.message }, { status: 500 });
  }
}

async function hashPassword(password) {
  const encoder = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
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
      salt,
      iterations: 100000,
      hash: "SHA-256"
    },
    keyMaterial,
    256
  );
  const hashHex = Array.from(new Uint8Array(derivedBits))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
  const saltHex = Array.from(salt)
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
  return `\( {saltHex}: \){hashHex}`;
      }
