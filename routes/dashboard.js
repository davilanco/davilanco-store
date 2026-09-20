module.exports=(db)=>{
  const router=require('express').Router();
  const {requireAuth}=require('../middleware/auth');
  const bcrypt=require('bcryptjs');
  router.use(requireAuth);
  
  router.get('/',async(req,res)=>{
    const user=await db('users').where('id',req.session.user.id).first();
    const cart=await db('carts').where('user_id',user.id).count('id as c').first();
    const orders=await db('orders').where('user_id',user.id).orderBy('created_at','desc');
    const messages=await db('messages').where('receiver_id',user.id).orderBy('created_at','desc').limit(10);
    const notifications=await db('notifications').where('user_id',user.id).orderBy('created_at','desc').limit(20);
    res.render('pages/dashboard',{title:'Dashboard',user,cartCount:cart.c,orders,messages,notifications});
  });

  router.post('/update',async(req,res)=>{
    const {first_name,last_name,nickname,phone,email}=req.body;
    await db('users').where('id',req.session.user.id).update({first_name,last_name,nickname,phone,email});
    req.session.user.nickname=nickname;
    res.redirect('/dashboard');
  });

  router.post('/password',async(req,res)=>{
    const {current,newPass}=req.body;
    const u=await db('users').where('id',req.session.user.id).first();
    const ok=await bcrypt.compare(current,u.password);
    if(!ok) return res.redirect('/dashboard?err=wrong');
    const hash=await bcrypt.hash(newPass,10);
    await db('users').where('id',req.session.user.id).update({password:hash});
    res.redirect('/dashboard?msg=passchanged');
  });

  router.post('/apply-seller',async(req,res)=>{
    const {products_plan,address,id_number}=req.body;
    await db('seller_applications').insert({user_id:req.session.user.id,products_plan,address,id_number,id_photo:''});
    await db('notifications').insert({user_id:req.session.user.id,title:'Seller application received',body:'Admin will review in 24h'});
    res.redirect('/dashboard?msg=applied');
  });

  router.get('/messages',async(req,res)=>{
    const msgs=await db('messages').where('receiver_id',req.session.user.id).orWhere('sender_id',req.session.user.id).orderBy('created_at','desc');
    res.render('pages/messages',{title:'Messages',msgs});
  });

  router.post('/messages',async(req,res)=>{
    const {receiver_id,message}=req.body;
    await db('messages').insert({sender_id:req.session.user.id,receiver_id,message});
    res.redirect('/dashboard/messages');
  });

  return router;
};
