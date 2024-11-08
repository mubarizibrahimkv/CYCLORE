const express=require("express")
const router=express.Router()
const userController=require("../controller/userController")
const userAuth=require("../middlewares/userAuth")
const passport=require("passport")


router.get("/pageNotFound",userController.pageNotFound)
router.get("/login",userAuth.isLogin,userController.loadLogin)
router.post("/login",userController.login)
router.get("/", userController.loadHomePage);
router.get("/register",userController.loadRegister);
router.post("/register",userController.registerUser);
router.post("/verify-otp",userController.verifyOtp)
router.post("/resend-otp",userController.resendOtp)
router.get("/shop",userController.loadShop)
router.get("/singleProduct/:id",userController.loadSingleProduct)
//-------googleAuthentication------------------------
router.get("/auth/google",passport.authenticate("google",{scope:["profile","email", "openid"]}))
router.get("/auth/google/callback",passport.authenticate("google", { failureRedirect: "/signup" }),userController.googleAuth);
router.get("/profile",userAuth.checkSession,userController.loadProfile)
router.post("/profile",userController.userLogout)


module.exports=router