const salesReportController=require("../controller/salesReportController")
const adminAuth=require("../middlewares/adminAuth")
const express=require("express")
const router=express.Router()

router.get("/salesReport",adminAuth.checkSession,salesReportController.loadSalesReport)
router.post("/salesReport",salesReportController.filter)
router.post('/sales-report/download/pdf',salesReportController.downloadPDFReport);
router.post('/sales-report/download/excel',salesReportController.downloadExcelReport);


module.exports=router