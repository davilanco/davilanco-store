module.exports=(db)=>{
  const router=require('express').Router();
  const {requireAuth}=require('../middleware/auth');
  router.use(requireAuth);
  router.get('/',async(req,res)=>{
    const items=await db('carts').join('products','products.id','carts.product_id').where('carts.user_id',req.session.user.id).select('carts.*','products.title','products.price','products.image');
    let total=items.reduce((s,i)=>s+(parseFloat(i.price)*i.qty),0);
    res.render('pages/cart',{title:'Cart',items,total});
  });
  router.post('/add/:id',async(req,res)=>{
    const exist=await db('carts').where({user_id:req.session.user.id,product_id:req.params.id}).first();
    if(exist) await db('carts').where('id',exist.id).increment('qty',1);
    else await db('carts').insert({user_id:req.session.user.id,product_id:req.params.id,qty:1});
    res.redirect('/cart');
  });
  router.post('/remove/:id',async(req,res)=>{await db('carts').where('id',req.params.id).del();res.redirect('/cart');});
  return router;
};
