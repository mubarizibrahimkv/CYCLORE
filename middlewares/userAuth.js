const checkSession=(req,res,next)=>{
    if(req.session.user){
        next();
    }else{
        res.redirect("/")
    }
}

const isLogin=(req,res,next)=>{
    if(req.session.user){
         res.redirect("/")
    }else{
        next()
    }
}

module.exports=({checkSession,isLogin});