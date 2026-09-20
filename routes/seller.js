module.exports=(db)=>{
  const router=require('express').Router();
  const {requireAuth,requireRole}=require('../middleware/auth');
  router.use(requireAuth,requireRole('seller','admin'));

  router.get('/',async(req,res)=>{
    const products=await db('products').where('seller_id',req.session.user.id).orderBy('created_at','desc');
    const orders=await db('orders').orderBy('created_at','desc');
    res.render('pages/seller',{title:'Seller Panel',products,orders});
  });

  router.post('/product',async(req,res)=>{
    const {title,description,price,stock,category,image}=req.body;
    await db('products').insert({title,description,price,stock,category,image,seller_id:req.session.user.id,status:'pending'});
    res.redirect('/seller');
  });

  router.post('/tracking/:id',async(req,res)=>{
    await db('orders').where('id',req.params.id).update({tracking_number:req.body.tracking_number,logistics_info:req.body.logistics_info,status:'shipping'});
    res.redirect('/seller');
  });
  return router;
};
