const discountController=require("../controller/discountController")
const adminAuth=require("../middlewares/adminAuth")
const express=require("express")
const router=express.Router()

router.get("/coupon",adminAuth.checkSession,discountController.loadCoupon)
router.post("/coupons/add",discountController.addCoupon)
router.post("/coupons/delete/:id",discountController.deleteCoupon)
router.post("/coupons/edit/:id",discountController.editCoupon)
router.get("/offer",adminAuth.checkSession,discountController.loadOffer)
router.post("/offers/add",discountController.addOffer)
router.post("/offers/edit/:id",discountController.editOffer)
router.post("/offers/delete/:id",discountController.deleteOffer)




module.exports=router