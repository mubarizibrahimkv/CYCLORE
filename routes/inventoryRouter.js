const express=require("express")
const router=express.Router()
const adminAuth=require("../middlewares/adminAuth")
const inventoryController=require("../controller/inventoryController")

router.get("/inventory",adminAuth.checkSession,inventoryController.loadInventory)
router.post("/inventory/update/:id",inventoryController.updateStock)

module.exports=router