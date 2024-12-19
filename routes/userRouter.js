const express=require("express")
const router=express.Router()
const userController=require("../controller/userController")
const userAuth=require("../middlewares/userAuth")
const passport=require("passport")


router.get("/auth/google",passport.authenticate("google",{scope:["profile","email", "openid"]}))
router.get("/auth/google/callback",passport.authenticate("google", { failureRedirect: "/signup" }),userController.googleAuth);
//-------end googleAuthentication----------------------
router.get("/pageNotFound",userController.pageNotFound)
router.get("/login",userAuth.isLogin,userController.loadLogin)
router.post("/login",userController.login)
router.get('/check-block-status',userController.checkBlockStatus)
router.get("/", userController.loadHomePage);
router.get("/register",userController.loadRegister);
router.post("/register",userController.registerUser);
router.post("/verify-otp",userController.verifyOtp)
router.post("/resend-otp",userController.resendOtp)
router.get("/shop",userController.loadShop)
router.get("/singleProduct/:id",userAuth.checkSession,userController.loadSingleProduct)
router.get("/forgot-password",userController.forgotPasswordPage)
router.post("/forget-email-valid",userController.forgotEmailValid)
router.post("/verify-passForgot-otp",userController.verifyForgotPassOtp)
router.get("/reset-password",userController.loadResetPassword)
router.post("/resend-forgot-otp",userController.forgotResendOtp)
router.post("/reset-password",userController.postNewPassword)
router.get("/contact",userAuth.checkSession,userController.loadContact)

module.exports=router