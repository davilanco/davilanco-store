sexport async function onRequestGet({env}) {
  const {results}=await env.DB.prepare("SELECT * FROM products WHERE status='approved'").all();
  return Response.json(results);
}
export async function onRequestPost({request, env}) {
  const p=await request.json();
  await env.DB.prepare("INSERT INTO products (id,name,price,category,image,description,seller_id,status) VALUES (?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(),p.name,p.price,p.category,p.image,p.desc,p.seller_id,'pending').run();
  return Response.json({ok:true});
}
