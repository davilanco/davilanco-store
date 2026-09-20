module.exports=(db)=>{
  const router=require('express').Router();
  const {requireAuth}=require('../middleware/auth');
  router.use(requireAuth);
  router.get('/',async(req,res)=>{
    const items=await db('carts').join('products','products.id','carts.product_id').where('carts.user_id',req.session.user.id).select('carts.*','products.title','products.price');
    const total=items.reduce((s,i)=>s+(parseFloat(i.price)*i.qty),0);
    res.render('pages/checkout',{title:'Checkout',items,total});
  });
  router.post('/',async(req,res)=>{
    const {first_name,last_name,phone,alt_phone,neighbor_phone,address,town,lga,state,payment_method}=req.body;
    const fullItems=await db('carts').join('products','products.id','carts.product_id').where('carts.user_id',req.session.user.id).select('products.*','carts.qty');
    const total=fullItems.reduce((s,i)=>s+(parseFloat(i.price)*i.qty),0);
    const ref='DAV-'+Date.now();
    await db('orders').insert({user_id:req.session.user.id,items:JSON.stringify(fullItems),total,first_name,last_name,phone,alt_phone,neighbor_phone,address,town,lga,state,payment_method,payment_ref:ref,status:'pending'});
    await db('carts').where('user_id',req.session.user.id).del();
    await db('notifications').insert({user_id:req.session.user.id,title:'Order placed '+ref,body:`Total ₦${total} via ${payment_method}. Ref: ${ref} - details saved to dashboard`});
    res.render('pages/order-success',{title:'Order Success',ref,total,payment_method});
  });
  return router;
};
