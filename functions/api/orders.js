export async function onRequest(context) {
  const {request, env} = context;
  await env.DB.exec(`CREATE TABLE IF NOT EXISTS orders (id TEXT PRIMARY KEY, user_id TEXT, items TEXT, total INTEGER, delivery TEXT, status TEXT DEFAULT 'Pending', tracking TEXT, logistics TEXT, eta TEXT, payment_method TEXT)`);
  if(request.method==="GET"){
    const {results}=await env.DB.prepare("SELECT * FROM orders").all();
    return Response.json(results);
  }
  if(request.method==="POST"){
    const o=await request.json();
    const id=crypto.randomUUID();
    await env.DB.prepare("INSERT INTO orders (id,user_id,items,total,delivery,status,payment_method) VALUES (?,?,?,?,?,?,?)").bind(id,o.user_id,JSON.stringify(o.items||[]),o.total,JSON.stringify(o),'Pending',o.payment_method).run();
    return Response.json({ok:true,id});
  }
  if(request.method==="PUT"){
    const {id,status,tracking,logistics,eta}=await request.json();
    await env.DB.prepare("UPDATE orders SET status=?, tracking=?, logistics=?, eta=? WHERE id=?").bind(status,tracking,logistics,eta,id).run();
    return Response.json({ok:true});
  }
  return Response.json({error:"method"}, {status:405});
      }
