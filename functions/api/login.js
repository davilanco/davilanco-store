export async function onRequestPost(context) {
  const {request, env} = context;
  const {login,password} = await request.json();
  const user = await env.DB.prepare("SELECT * FROM users WHERE nickname=? OR email=? OR phone=?").bind(login,login,login).first();
  if(!user || user.password!==password) return Response.json({error:"Invalid login"}, {status:401});
  return Response.json({ok:true,user});
}
