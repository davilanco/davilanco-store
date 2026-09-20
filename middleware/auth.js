module.exports.requireAuth = (req,res,next)=>{
  if(!req.session.user){
    req.session.returnTo = req.originalUrl;
    return res.redirect('/login');
  }
  next();
};

module.exports.requireRole = (...roles)=> (req,res,next)=>{
  if(!req.session.user) return res.redirect('/login');
  if(!roles.includes(req.session.user.role)) return res.status(403).render('pages/403',{title:'Forbidden'});
  next();
};
