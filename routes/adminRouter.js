const express=require("express")
const router=express.Router()
const adminController=require("../controller/adminController")
const upload=require("../controller/imageController")
const adminAuth=require("../middlewares/adminAuth")
const dashboardController=require("../controller/dashboardController")

router.get('/login',adminAuth.isLogin,adminController.loadLogin)
router.post("/login",adminController.login)


router.get("/dashboard",adminAuth.checkSession,dashboardController.loadDashboard)
router.get("/sales-data",dashboardController.getSalesData)

router.get("/users",adminAuth.checkSession,adminController.loadUserManagement);
router.post("/users/block/:id", adminAuth.checkSession, adminController.blockUser); 
router.post("/users/unblock/:id", adminAuth.checkSession, adminController.unblockUser); 
router.get("/categories",adminAuth.checkSession,adminController.loadCategories)
router.post("/categories/add",adminController.addCategory)
router.get('/categories/check-duplicate',adminController.checkDuplicateAddCategory);
router.post("/categories/edit",adminController.editCategory)
router.post("/categories/check-duplicate",adminController.checkDuplicateEditCategory)
router.post('/categories/toggle-status/:id', adminController.toggleCategoryStatus);
router.get("/products",adminAuth.checkSession,adminController.loadProducts)
router.post("/products/toggle-status/:id",adminController.toggleProductStatus)
router.post("/products/add",upload.array('images',3),adminController.addProduct)
router.post("/products/edit",upload.any('images',3),adminController.editProduct);
router.get("/profile",adminAuth.checkSession,adminController.loadProfile)
router.post("/profile",adminController.logout)


module.exports=router;