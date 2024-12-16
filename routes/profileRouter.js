const express=require("express")
const router=express.Router()
const profileCotroller=require("../controller/profileController")
const userAuth=require("../middlewares/userAuth")
const invoiceController=require("../controller/invoiceController")

router.get("/profile",userAuth.checkSession,profileCotroller.loadProfile)
router.post("/profile",profileCotroller.userLogout)
router.post("/profile/saveAddress",profileCotroller.saveAddress)
router.post("/profile/updateAddress",profileCotroller.updateAddress)
router.post("/profile/deleteAddress/:id",profileCotroller.deleteAddress)
router.get("/profile/order",userAuth.checkSession,profileCotroller.loadOrder)
router.post("/profile/order",profileCotroller.retryPaymentSuccess)
router.post('/order/retry/:orderId',profileCotroller.retryPayment)
router.post('/order/cancel/:orderId/:productId', profileCotroller.cancelOrder);
router.post("/profile/change-password",profileCotroller.changePassword)
router.post("/order/fail/:orderId",profileCotroller.updatePaymentFailure)
router.get("/profile/order/viewDetails/:orderId/:productId",userAuth.checkSession,profileCotroller.loadViewDetails)
router.get("/downloadInvoice/:id",invoiceController.invoiceDownload)
router.get("/wishlist",userAuth.checkSession,profileCotroller.loadWishlist)
router.get("/profile/wallet",userAuth.checkSession,profileCotroller.loadWallet)
router.get("/wishlist/add/:id",userAuth.checkSession,profileCotroller.addWishlist)
router.post('/wishlist/delete/:id',profileCotroller.removeWishlist);
router.put('/product/return/:orderId/:productId',profileCotroller.returnProduct)




module.exports=router