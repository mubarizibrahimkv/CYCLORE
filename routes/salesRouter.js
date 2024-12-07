const express=require("express")
const router=express.Router()
const salesController=require("../controller/salesController")
const userAuth=require("../middlewares/userAuth")

router.get("/cart",userAuth.checkSession,salesController.loadCart)
router.get("/cart/add/:id",salesController.addCart)
router.delete("/cart/cancel/:productId",salesController.cancelProduct)
router.get("/checkout",userAuth.checkSession,salesController.loadCheckout)
router.post("/checkout/updateAddress",salesController.updateAddress)
router.post("/checkout/addAddress",salesController.saveAddress)
router.get("/orderSuccess",userAuth.checkSession,salesController.loadOrderSuccess)
router.post("/checkout",salesController.saveOrder)
router.post("/updateCart",salesController.updateCartQuantity)
router.post("/createRazorpayOrder",salesController.createRazorpayOrder)
router.post("/checkout/createWalletOrder",salesController.createWalletOrder)
router.post("/applyCoupon",salesController.applyCoupon)
router.post("/checkout",salesController.paymentFailer)


module.exports=router