const Order = require("../Model/orderModel");
const PDFDocument = require("pdfkit");

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

  // Include Coupon Details
  if (order.couponCode && order.couponDiscount > 0) {
    doc
      .text(`Coupon Applied: ${order.couponCode}`, 50, 260)
      .text(`Coupon Discount: ₹${order.couponDiscount}`, 50, 275);
  } else {
    doc.text(`Coupon Applied: None`, 50, 260);
  }
}

function generateInvoiceTable(doc, order) {
  const invoiceTableTop = 300;

  // Table Header
  doc.fontSize(12).text("Items", 50, invoiceTableTop);
  doc.text("Qty", 200, invoiceTableTop, { width: 90, align: "right" });
  doc.text("Unit Price", 300, invoiceTableTop, { width: 90, align: "right" });
  doc.text("Total", 400, invoiceTableTop, { width: 90, align: "right" });

  // Initialize adjusted subtotal
  let adjustedSubtotal = 0;

  // Table Content
  order.products.forEach((product, index) => {
    const yPosition = invoiceTableTop + 25 + index * 25;
    const unitPrice = product.discountedPrice || product.productId.price;
    const totalPrice = unitPrice * product.quantity;

    doc.fontSize(10).text(product.productId.name, 50, yPosition);
    doc.text(product.quantity, 200, yPosition, { width: 90, align: "right" });
    doc.text(`₹${unitPrice}`, 300, yPosition, { width: 90, align: "right" });
    doc.text(`₹${totalPrice}`, 400, yPosition, { width: 90, align: "right" });

    if (product.status) {
      doc.fontSize(8).fillColor("red").text(
        `Status: ${product.status}`,
        50,
        yPosition + 10
      );
      doc.fillColor("black");
    }

    if (["Cancelled", "Returned"].includes(product.status)) {
      doc.fontSize(8).fillColor("orange").text(
        `${product.status}: Yes`,
        50,
        yPosition + 20
      );
      doc.fillColor("black");
    } else {
      doc.fontSize(8).fillColor("green").text(
        `Cancelled/Returned: No`,
        50,
        yPosition + 20
      );
      doc.fillColor("black");

      adjustedSubtotal += totalPrice;
    }

    if (product.discountedPrice && product.discountedPrice < product.productId.price) {
      doc.fontSize(8).fillColor("green").text(
        `Offer Applied: Original Price ₹${product.productId.price}`,
        50,
        yPosition + 30
      );
      doc.fillColor("black");
    }
  });

  const couponDiscount = order.couponDiscount || 0;
  const shippingCost = order.shippingCost || 0;
  const adjustedTotal = adjustedSubtotal - couponDiscount + shippingCost;

  const totalY = invoiceTableTop + 25 + order.products.length * 25;

  doc.text(`Subtotal: ₹${adjustedSubtotal}`, 400, totalY, { width: 90, align: "right" });

  if (couponDiscount > 0) {
    doc.text(`Coupon Discount: -₹${couponDiscount}`, 400, totalY + 20, { width: 90, align: "right" });
  }

  doc.text(`Shipping Cost: ₹${shippingCost}`, 400, totalY + 40, { width: 90, align: "right" });
  doc.text(`Total: ₹${adjustedTotal}`, 400, totalY + 60, { width: 90, align: "right" });
}



function generateFooter(doc) {
  doc
    .fontSize(10)
    .text("Thank you for your purchase!", 50, 750, { align: "center", width: 500 })
    .text("This invoice is generated electronically and does not require a signature.", 50, 765, { align: "center", width: 500 });
}


const invoiceDownload = async (req, res) => {
  const orderId = req.params.id;

  try {
    const order = await Order.findById(orderId)
      .populate("userId")
      .populate("products.productId")
      .populate("address")
      .exec();

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

    const discountApplied = order.couponDiscount || 0;

    const finalTotal = updatedTotal - discountApplied;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=invoice_${orderId}.pdf`
    );

    createInvoice(
      {
        ...order.toObject(),
        total: order.total, // Use the stored total
        couponCode: order.couponCode || "N/A", // Include coupon code
        discountApplied: order.couponDiscount || 0, // Use couponDiscount directly
      },
      res
    );
  } catch (error) {
    console.error("Error generating invoice:", error);
    res.status(500).send("Internal Server Error");
  }
};

module.exports = { invoiceDownload };
