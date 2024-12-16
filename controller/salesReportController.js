const orderModel = require("../Model/orderModel")
const PDFDocument = require('pdfkit');
const XLSX = require('xlsx');


const loadSalesReport = async (req, res) => {
    try {
        const orders = await orderModel.find().populate("userId").populate("products.productId");

        let dailyReport = {};
        let overallOrderCount = 0;
        let overallTotalSales = 0;
        let overallTotalDiscount = 0;
        let overallNetSales = 0;

        orders.forEach(order => {
            const validProducts = order.products.filter(product => 
                product.status !== "Cancelled" && product.status !== "Returned"
            );
                        
            if (validProducts.length === 0) {
                return;
            }

            const orderDate = order.createdAt.toISOString().split('T')[0];

            const orderTotal = validProducts.reduce(
                (sum, product) => sum + (product.price * product.quantity),
                0
            );
            const offerTotal = validProducts.reduce(
                (sum, product) => sum + (product.discountedPrice * product.quantity),
                0
            );

            const orderTotalWithShippingCost = orderTotal + order.shippingCost;
            const offeredPriceWithShippingCost = offerTotal + order.shippingCost;
            const offerDiscount = orderTotalWithShippingCost - offeredPriceWithShippingCost;
            const couponDiscount = order.couponDiscount || 0;
            const discount = offerDiscount + couponDiscount;

            if (!dailyReport[orderDate]) {
                dailyReport[orderDate] = {
                    totalOrders: 0,
                    totalAmount: 0,
                    totalDiscount: 0,
                    netSales: 0
                };
            }

            dailyReport[orderDate].totalOrders++;
            dailyReport[orderDate].totalAmount += orderTotalWithShippingCost;
            dailyReport[orderDate].totalDiscount += discount;
            dailyReport[orderDate].netSales += order.total;

            overallOrderCount++;
            overallTotalSales += orderTotalWithShippingCost;
            overallTotalDiscount += discount;
            overallNetSales += orderTotalWithShippingCost - discount;
        });

        const dailyReportArray = Object.keys(dailyReport).map(date => ({
            date,
            ...dailyReport[date]
        }));

        res.render("admin/salesReport", {
            dailyReport: dailyReportArray,
            overallOrderCount,
            overallTotalSales,
            overallTotalDiscount,
            overallNetSales
        });

    } catch (error) {
        console.error("Error loading sales report:", error);
        res.status(500).send("Error loading sales report.");
    }
};

const downloadPDFReport = async (req, res) => {
    try {
        const { salesData } = req.body;

        const doc = new PDFDocument({ size: 'A4', margin: 50 });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename=sales_report.pdf');

        doc.fontSize(16).text('Sales Report', { align: 'center' });
        doc.moveDown(1); 

        const tableHeaders = ['Date', 'Order Count', 'Total Sales', 'Discount', 'Net Sales'];
        const tableWidths = [100, 80, 100, 100, 100]; 

        let x = 50;
        let y = doc.y; 

        y = 100; 

        doc.fontSize(12).font('Helvetica-Bold');
        tableHeaders.forEach((header, index) => {
            doc.text(header, x, y, { width: tableWidths[index], align: 'center' });
            x += tableWidths[index]; 
        });

        x = 50; 
        tableHeaders.forEach((_, index) => {
            doc.rect(x, y - 10, tableWidths[index], 20).stroke(); 
            x += tableWidths[index];
        });

        doc.moveDown(0.2); 
        y = doc.y;

        doc.fontSize(10).font('Helvetica');
        salesData.forEach(item => {
            x = 50; 
            const rowY = y; 

            doc.text(item.date, x, rowY, { width: tableWidths[0], align: 'center' });
            x += tableWidths[0];

            doc.text(item.orderCount, x, rowY, { width: tableWidths[1], align: 'center' });
            x += tableWidths[1];

            doc.text(item.totalSales, x, rowY, { width: tableWidths[2], align: 'center' });
            x += tableWidths[2];

            doc.text(item.discount, x, rowY, { width: tableWidths[3], align: 'center' });
            x += tableWidths[3];

            doc.text(item.netSales, x, rowY, { width: tableWidths[4], align: 'center' });
            x += tableWidths[4];

            x = 50;
            tableHeaders.forEach((_, index) => {
                doc.rect(x, rowY - 5, tableWidths[index], 20).stroke(); 
                x += tableWidths[index];
            });

            y = rowY + 20; 
        });

        doc.end();
        doc.pipe(res);
    } catch (error) {
        console.error('Error generating PDF:', error);
        res.status(500).send('Error generating PDF.');
    }
};

const downloadExcelReport = async (req, res) => {
    try {
        const { salesData } = req.body;

        if (!Array.isArray(salesData) || salesData.length === 0) {
            return res.status(400).send('No sales data available');
        }

        const wb = XLSX.utils.book_new();

        const ws = XLSX.utils.json_to_sheet(salesData, {
            header: ['date', 'orderCount', 'totalSales', 'discount', 'netSales'],
        });

        XLSX.utils.book_append_sheet(wb, ws, 'Sales Report');

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=sales_report.xlsx');

        const excelFile = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });

        res.send(excelFile);
        res.end();

    } catch (error) {
        console.error('Error generating Excel:', error);
        res.status(500).send('Error generating Excel.');
    }
};

const filter = async (req, res) => {    
    const { specificDay, quickRange, fromDate, toDate } = req.body;

    try {
        let query = {};
        const now = new Date();

        if (specificDay) {
            const startOfDay = new Date(specificDay);
            startOfDay.setHours(0, 0, 0, 0);
            const endOfDay = new Date(specificDay);
            endOfDay.setHours(23, 59, 59, 999);
            query.createdAt = { $gte: startOfDay, $lte: endOfDay };
        }

        if (quickRange === '1day') {
            const yesterday = new Date(now);
            yesterday.setDate(now.getDate() - 1);
            query.createdAt = { $gte: yesterday, $lte: now };
        } else if (quickRange === '1week') {
            const lastWeek = new Date(now);
            lastWeek.setDate(now.getDate() - 7);
            query.createdAt = { $gte: lastWeek, $lte: now };
        } else if (quickRange === '1month') {
            const lastMonth = new Date(now);
            lastMonth.setMonth(now.getMonth() - 1);
            query.createdAt = { $gte: lastMonth, $lte: now };
        }

        if (fromDate && toDate) {
            const startDate = new Date(fromDate);
            const endDate = new Date(toDate);
            query.createdAt = { $gte: startDate, $lte: endDate };
        }

        const dailyReport = await orderModel.aggregate([
            { $match: query },
            { $unwind: "$products" },
            // Exclude cancelled and returned products
            {
                $match: {
                    "products.status": { $nin: ["Cancelled", "Returned"] }
                }
            },
            {
                $group: {
                    _id: {
                        date: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                        orderId: "$_id"
                    },
                    totalProductsPrice: {
                        $sum: { $multiply: ["$products.price", "$products.quantity"] }
                    },
                    shippingCost: { $first: "$shippingCost" },
                    total: { $first: "$total" }
                }
            },
            {
                $group: {
                    _id: "$_id.date",
                    totalOrders: { $sum: 1 },
                    totalAmount: {
                        $sum: { $add: ["$totalProductsPrice", "$shippingCost"] }
                    },
                    totalDiscount: {
                        $sum: {
                            $subtract: [
                                { $add: ["$totalProductsPrice", "$shippingCost"] },
                                "$total"
                            ]
                        }
                    },
                    netSales: {
                        $sum: "$total"
                    }
                }
            },
            { $sort: { _id: -1 } }
        ]);

        const formattedReport = dailyReport.map(report => ({
            ...report,
            date: new Date(report._id).toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric"
            })
        }));

        res.json({ dailyReport: formattedReport });
    } catch (error) {
        console.error("Error fetching sales report:", error);
        res.status(500).json({ error: "Server error" });
    }
};


module.exports = {
    loadSalesReport,
    downloadExcelReport,
    downloadPDFReport,
    filter
}