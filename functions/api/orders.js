export async function onRequestGet({env}) {
  const {results}=await env.DB.prepare("SELECT * FROM orders").all();
  return Response.json(results);
}
export async function onRequestPost({request, env}) {
  const o=await request.json();
  const id=crypto.randomUUID();
  await env.DB.prepare("INSERT INTO orders (id,user_id,items,total,delivery,status,payment_method) VALUES (?,?,?,?,?,?,?)").bind(id,o.user_id,JSON.stringify(o.items),o.total,JSON.stringify(o), 'Pending', o.payment_method).run();
  return Response.json({ok:true,id});
}
export async function onRequestPut({request, env}) {
  const {id,status,tracking,logistics,eta}=await request.json();
  await env.DB.prepare("UPDATE orders SET status=?, tracking=?, logistics=?, eta=? WHERE id=?").bind(status,tracking,logistics,eta,id).run();
  return Response.json({ok:true});
    }
