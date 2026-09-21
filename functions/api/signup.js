export async function onRequestPost({request, env}) {
  const {firstname,lastname,nickname,phone,email,password} = await request.json();
  if(password.length<8) return Response.json({error:"Weak password"}, {status:400});
  const id=crypto.randomUUID();
  await env.DB.prepare("INSERT INTO users (id,firstname,lastname,nickname,phone,email,password,role) VALUES (?,?,?,?,?,?,?,?)").bind(id,firstname,lastname,nickname,phone,email,password,'customer').run();
  return Response.json({ok:true,id});
}
