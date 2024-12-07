const orderController=require("../controller/orderController")
const adminAuth=require("../middlewares/adminAuth")
const express=require("express")
const router=express.Router()

router.get("/orders",adminAuth.checkSession,orderController.loadOrder)
router.post("/order/cancelStatus/:orderId/:productId",orderController.cancelOrder)
router.post("/orders/status/:orderId/:productId", orderController.updateProductStatus);
router.get("/order/orderDetails/:orderId",adminAuth.checkSession,orderController.orderDetails)


module.exports=router