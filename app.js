require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');
const helmet = require('helmet');
const knex = require('knex');
const app = express();
const PORT = process.env.PORT || 3000;

const db = knex({
  client: 'mysql2',
  connection: {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT || 4000,
    ssl: { rejectUnauthorized: true }
  }
});
app.locals.db = db;

app.use(helmet({contentSecurityPolicy:false}));
app.use(express.urlencoded({extended:true}));
app.use(express.json());
app.use(express.static(path.join(__dirname,'public')));
app.set('view engine','ejs');

app.use(session({
  secret: process.env.SESSION_SECRET || 'davilanco_secret',
  resave:false, saveUninitialized:false,
  store: new (require('connect-session-knex')(session))({knex:db, tablename:'sessions'}),
  cookie:{maxAge:1000*60*60*24*7}
}));

app.use(async (req,res,next)=>{
  res.locals.user=req.session.user||null;
  res.locals.query=req.query;
  if(req.session.user){
    try{ 
      const n=await db('notifications').where({user_id:req.session.user.id,is_read:0}).count('id as c').first(); 
      res.locals.unreadCount=n.c; 
    }catch{res.locals.unreadCount=0}
  }
  next();
});

app.use((req,res,next)=>{
  if(!req.session.user && req.method==='GET' && !req.path.includes('.') && !['/login','/signup','/robots.txt','/sitemap.xml'].some(p=>req.path.startsWith(p))){
    req.session.returnTo=req.originalUrl;
  }
  next();
});

app.use('/', require('./routes/pages')(db));
app.use('/', require('./routes/auth')(db));
app.use('/dashboard', require('./routes/dashboard')(db));
app.use('/admin', require('./routes/admin')(db));
app.use('/seller', require('./routes/seller')(db));
app.use('/cart', require('./routes/cart')(db));
app.use('/checkout', require('./routes/checkout')(db));

app.get('/robots.txt',(req,res)=>res.type('text/plain').send(`User-agent: *\nAllow: /\nSitemap: ${process.env.BASE_URL||'https://shop.davilanco.com'}/sitemap.xml`));

app.get('/sitemap.xml', async (req,res)=>{
  const products = await db('products').select('id','updated_at');
  let xml=`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${process.env.BASE_URL}/</loc><priority>1.0</priority></url>`;
  products.forEach(p=>{ xml+=`<url><loc>${process.env.BASE_URL}/product/${p.id}</loc><lastmod>${new Date(p.updated_at).toISOString()}</lastmod></url>`});
  xml+=`</urlset>`; 
  res.type('application/xml').send(xml);
});

async function initDB(){
  const has=await db.schema.hasTable('users');
  if(!has){
    await db.schema.createTable('users',t=>{
      t.increments('id');t.string('first_name').notNullable();t.string('last_name').notNullable();
      t.string('nickname').unique().notNullable();t.string('phone').unique().notNullable();
      t.string('email').unique().notNullable();t.string('password').notNullable();
      t.enum('role',['customer','seller','admin']).defaultTo('customer');
      t.boolean('is_verified').defaultTo(false);t.string('verify_token');
      t.boolean('is_suspended').defaultTo(false);t.timestamps(true,true);
    });
    await db.schema.createTable('sessions',t=>{t.string('sid').primary();t.json('sess').notNullable();t.timestamp('expired').notNullable().index();});
    await db.schema.createTable('products',t=>{
      t.increments('id');t.string('title').notNullable();t.text('description');
      t.decimal('price',10,2).notNullable();t.integer('stock').defaultTo(100);
      t.string('category');t.string('image');t.integer('seller_id').references('id').inTable('users');
      t.enum('status',['pending','approved','rejected']).defaultTo('approved');t.timestamps(true,true);
    });
    await db.schema.createTable('carts',t=>{t.increments('id');t.integer('user_id').references('id').inTable('users');t.integer('product_id').references('id').inTable('products');t.integer('qty').defaultTo(1);t.timestamps(true,true);});
    await db.schema.createTable('orders',t=>{
      t.increments('id');t.integer('user_id').references('id').inTable('users');t.json('items');
      t.decimal('total',10,2);t.string('first_name');t.string('last_name');t.string('phone');
      t.string('alt_phone');t.string('neighbor_phone');t.text('address');
      t.string('town');t.string('lga');t.string('state');
      t.enum('payment_method',['bank_transfer','paystack','flutterwave','paypal']).defaultTo('bank_transfer');
      t.string('payment_ref');t.enum('status',['pending','approved','shipping','delivered']).defaultTo('pending');
      t.string('tracking_number');t.text('logistics_info');t.timestamps(true,true);
    });
    await db.schema.createTable('messages',t=>{t.increments('id');t.integer('sender_id').references('id').inTable('users');t.integer('receiver_id').references('id').inTable('users');t.text('message');t.boolean('is_read').defaultTo(false);t.timestamps(true,true);});
    await db.schema.createTable('notifications',t=>{t.increments('id');t.integer('user_id').references('id').inTable('users');t.string('title');t.text('body');t.boolean('is_read').defaultTo(false);t.timestamps(true,true);});
    await db.schema.createTable('seller_applications',t=>{t.increments('id');t.integer('user_id').references('id').inTable('users');t.text('products_plan');t.text('address');t.string('id_number');t.string('id_photo');t.enum('status',['pending','approved','rejected']).defaultTo('pending');t.timestamps(true,true);});
    console.log('Tables created');
  }
}
initDB().catch(console.error);

app.use((req,res)=>res.status(404).render('pages/404',{title:'Not Found'}));
app.listen(PORT,()=>console.log('Davilanco running on '+PORT));
