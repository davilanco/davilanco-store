export async function onRequestPost(context) {
  const {request, env} = context;
  await env.DB.exec(`CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, firstname TEXT, lastname TEXT, nickname TEXT UNIQUE, phone TEXT UNIQUE, email TEXT UNIQUE, password TEXT, role TEXT DEFAULT 'customer', status TEXT DEFAULT 'active', address TEXT, products TEXT, idnumber TEXT, idphoto TEXT)`);
  const {firstname,lastname,nickname,phone,email,password} = await request.json();
  const id=crypto.randomUUID();
  try{
    await env.DB.prepare("INSERT INTO users (id,firstname,lastname,nickname,phone,email,password,role) VALUES (?,?,?,?,?,?,?,?)").bind(id,firstname,lastname,nickname,phone,email,password,'customer').run();
    return Response.json({ok:true,id});
  }catch(e){ return Response.json({error:e.message}, {status:400}); }
    }
