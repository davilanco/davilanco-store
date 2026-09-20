module.exports=(db)=>{
  const router=require('express').Router();
  const bcrypt=require('bcryptjs');
  const crypto=require('crypto');

  router.get('/signup',(req,res)=>res.render('pages/signup',{title:'Create Account',errors:[],form:{}}));

  router.post('/signup',async(req,res)=>{
    const {first_name,last_name,nickname,phone,email,password,confirm}=req.body;
    const errors=[];
    if(!first_name||!last_name||!nickname||!phone||!email||!password) errors.push('All fields required');
    if(password!==confirm) errors.push('Passwords do not match');
    if(password.length<8 ||!/[A-Z]/.test(password) ||!/[0-9]/.test(password) ||!/[^A-Za-z0-9]/.test(password)) errors.push('Password must be 8+ chars with uppercase, number, symbol');
    if(errors.length) return res.render('pages/signup',{title:'Signup',errors,form:req.body});
    try{
      const hash=await bcrypt.hash(password,10);
      const token=crypto.randomBytes(20).toString('hex');
      const [id]=await db('users').insert({first_name,last_name,nickname,phone,email,password:hash,verify_token:token,role:'customer'});
      await db('notifications').insert({user_id:id,title:'Welcome to Davilanco',body:'Account created successfully'});
      res.redirect('/login?verified=1');
    }catch(e){
      errors.push(e.message.includes('Duplicate')?'Nickname/email/phone already used':e.message);
      res.render('pages/signup',{title:'Signup',errors,form:req.body});
    }
  });

  router.get('/login',(req,res)=>res.render('pages/login',{title:'Login',error:null}));

  router.post('/login',async(req,res)=>{
    const {identifier,password}=req.body;
    const user=await db('users').where('email',identifier).orWhere('nickname',identifier).orWhere('phone',identifier).first();
    if(!user) return res.render('pages/login',{title:'Login',error:'Account not found'});
    if(user.is_suspended) return res.render('pages/login',{title:'Login',error:'Account suspended'});
    const ok=await bcrypt.compare(password,user.password);
    if(!ok) return res.render('pages/login',{title:'Login',error:'Wrong password'});
    req.session.user={id:user.id,nickname:user.nickname,email:user.email,role:user.role,first_name:user.first_name};
    const to=req.session.returnTo|| (user.role==='admin'?'/admin':user.role==='seller'?'/seller':'/dashboard');
    delete req.session.returnTo;
    res.redirect(to);
  });

  router.get('/logout',(req,res)=>{req.session.destroy(()=>res.redirect('/'));});
  return router;
};
