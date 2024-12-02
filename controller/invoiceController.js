const Order=require("../Model/orderModel")
const PDFDocument = require('pdfkit');

function createInvoice(invoice, res) {
  const doc = new PDFDocument({ size: "A4", margin: 50 });

  generateHeader(doc);
  generateCustomerInformation(doc, invoice);
  generateInvoiceTable(doc, invoice);
  generateFooter(doc);

  doc.pipe(res);
  doc.end();
}

function generateHeader(doc) {
  doc
    .fillColor("#444444")
    .fontSize(20)
    .text("CYCLORE", 50, 45)
    .fontSize(10)
    .text("ACME Inc.", 200, 50, { align: "right" })
    .text("Bangalore, India", 200, 65, { align: "right" })
    .text("Phone: +9083764514", 200, 80, { align: "right" })
    .moveDown();
}

function generateCustomerInformation(doc, order) {
  doc
    .fillColor("#444444")
    .fontSize(20)
    .text("Invoice", 50, 160);

  doc.fontSize(10).text(`Order ID: ${order._id}`, 50, 200);
  doc.text(`Invoice Date: ${new Date(order.createdAt).toLocaleDateString()}`, 50, 215);
  doc.text(`Customer Name: ${order.address.firstName || "N/A"}`, 50, 230);
  doc.text(`Customer Address: ${order.address.address || "N/A"}`, 50, 245);
}

function generateInvoiceTable(doc, order) {
  const invoiceTableTop = 300;

  doc.fontSize(12).text("Items", 50, invoiceTableTop);
  doc.text("Qty", 200, invoiceTableTop, { width: 90, align: "right" });
  doc.text("Unit Price", 300, invoiceTableTop, { width: 90, align: "right" });
  doc.text("Total", 400, invoiceTableTop, { width: 90, align: "right" });

  order.products.forEach((product, index) => {
    const yPosition = invoiceTableTop + 25 + index * 25;
    const unitPrice = product.discountedPrice || product.productId.price;
    const totalPrice = unitPrice * product.quantity;

    doc.fontSize(10).text(product.productId.name, 50, yPosition);
    doc.text(product.quantity, 200, yPosition, { width: 90, align: "right" });
    doc.text(`₹${unitPrice}`, 300, yPosition, { width: 90, align: "right" });
    doc.text(`₹${totalPrice}`, 400, yPosition, { width: 90, align: "right" });
  });

  const totalY = invoiceTableTop + 25 + order.products.length * 25;
  doc
    .fontSize(12)
    .text(`Total: ₹${order.total}`, 400, totalY, { width: 90, align: "right" });
}

function generateFooter(doc) {
  doc
    .fontSize(10)
    .text("Thank you for your purchase!", 50, 780, { align: "center", width: 500 });
}

const invoiceDownload = async (req, res) => {
  const orderId = req.params.id;  

  try {
    const order = await Order.findById(orderId).populate("userId").populate("products.productId").populate("address").exec();
    if (!order) {
      return res.status(404).send("Order not found");
    }

    const canceledTotal = order.products
    .filter((item) => item.status === "Cancelled")
    .reduce((sum, item) => {
      const price = item.discountedPrice || item.productId.price; 
      return sum + price * item.quantity;
    }, 0);

  const updatedTotal = order.total - canceledTotal;

    order.products = order.products.filter(item => item.status !== "Cancelled");

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=invoice_${orderId}.pdf`);

    createInvoice({ ...order.toObject(), total: updatedTotal }, res);
  } catch (error) {
    console.error("Error generating invoice:", error);
    res.status(500).send("Internal Server Error");
  }
};

module.exports = { invoiceDownload };
