module.exports=(db)=>{
  const router=require('express').Router();
  router.get('/',async(req,res)=>{
    const {search,category}=req.query;
    let q=db('products').where('status','approved');
    if(search) q=q.where('title','like',`%${search}%`);
    if(category) q=q.where('category',category);
    const products=await q.orderBy('created_at','desc').limit(48);
    const categories=await db('products').distinct('category').pluck('category');
    res.render('pages/home',{title:'Davilanco Marketplace',products,categories});
  });
  router.get('/product/:id',async(req,res)=>{
    const product=await db('products').where('id',req.params.id).first();
    if(!product) return res.status(404).render('pages/404',{title:'Not Found'});
    res.render('pages/product',{title:product.title,product});
  });
  router.get('/categories',async(req,res)=>{
    const categories=await db('products').select('category').count('id as count').where('status','approved').groupBy('category');
    res.render('pages/categories',{title:'Categories',categories});
  });
  return router;
};
