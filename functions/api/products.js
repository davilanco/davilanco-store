export async function onRequest(context) {
  const {request, env} = context;
  await env.DB.exec(`CREATE TABLE IF NOT EXISTS products (id TEXT PRIMARY KEY, name TEXT, price INTEGER, category TEXT, image TEXT, description TEXT, seller_id TEXT, status TEXT DEFAULT 'pending')`);
  if(request.method==="GET"){
    const {results}=await env.DB.prepare("SELECT * FROM products").all();
    return Response.json(results);
  }
  if(request.method==="POST"){
    const p=await request.json();
    await env.DB.prepare("INSERT INTO products (id,name,price,category,image,description,seller_id,status) VALUES (?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(),p.name,p.price,p.category,p.image,p.desc,p.seller_id,'pending').run();
    return Response.json({ok:true});
  }
  return Response.json({error:"method"}, {status:405});
      }
