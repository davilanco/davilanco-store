module.exports=(db)=>{
  const router=require('express').Router();
  const {requireAuth,requireRole}=require('../middleware/auth');
  router.use(requireAuth,requireRole('admin'));

  router.get('/',async(req,res)=>{
    const users=await db('users').select('*').orderBy('created_at','desc');
    const products=await db('products').orderBy('created_at','desc');
    const orders=await db('orders').orderBy('created_at','desc');
    const applications=await db('seller_applications').join('users','users.id','seller_applications.user_id').select('seller_applications.*','users.nickname').orderBy('seller_applications.created_at','desc');
    res.render('pages/admin',{title:'Admin Panel',users,products,orders,applications});
  });

  router.post('/promote/:id',async(req,res)=>{await db('users').where('id',req.params.id).update({role:'seller'});res.redirect('/admin');});
  router.post('/suspend/:id',async(req,res)=>{await db('users').where('id',req.params.id).update({is_suspended:1});res.redirect('/admin');});
  router.post('/reactivate/:id',async(req,res)=>{await db('users').where('id',req.params.id).update({is_suspended:0});res.redirect('/admin');});
  router.post('/order-status/:id',async(req,res)=>{await db('orders').where('id',req.params.id).update({status:req.body.status,tracking_number:req.body.tracking_number,logistics_info:req.body.logistics_info});res.redirect('/admin');});
  router.post('/product-approve/:id',async(req,res)=>{await db('products').where('id',req.params.id).update({status:req.body.status});res.redirect('/admin');});
  router.post('/application/:id',async(req,res)=>{
    const app=await db('seller_applications').where('id',req.params.id).first();
    if(req.body.action==='approve'){await db('users').where('id',app.user_id).update({role:'seller'});await db('seller_applications').where('id',req.params.id).update({status:'approved'});}
    else await db('seller_applications').where('id',req.params.id).update({status:'rejected'});
    res.redirect('/admin');
  });
  return router;
};
