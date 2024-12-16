const orderModel = require("../Model/orderModel")
const productModel = require("../Model/productModel")
const walletModel = require("../Model/walletModel")

const loadOrder = async (req, res) => {
    const { page = 1, limit = 10 } = req.query;

    try {
        const orders = await orderModel.find()
            .sort({ createdAt: -1 })
            .populate("userId")
            .populate("products.productId")
            .skip((page - 1) * limit)
            .limit(Number(limit))
            .exec();

        const totalOrders = await orderModel.countDocuments();

        const totalPages = Math.ceil(totalOrders / limit);
        const currentPage = Number(page);
        const previousPage = currentPage > 1 ? currentPage - 1 : null;
        const nextPage = currentPage < totalPages ? currentPage + 1 : null;

        res.render("admin/orders", {
            orders,
            currentPage,
            totalPages,
            totalOrders,
            previousPage,
            nextPage
        });

    } catch (error) {
        console.error(error);
        res.send("Error fetching orders");
    }
}

const cancelOrder = async (req, res) => {
    const { userId, orderId, productId } = req.params;

    try {
        const order = await orderModel.findById(orderId);

        if (!order) {
            return res.status(404).send('Order not found');
        }

        const product = order.products.find(p => p.productId.toString() === productId);

        const currentProduct = await productModel.findById(productId);
        if (!product) {
            return res.status(404).send('Product not found');
        }

        product.status = 'Cancelled';

        currentProduct.stock += product.quantity;
        await currentProduct.save();

        let wallet = await walletModel.findOne({ userId });

        let refundAmount = product.discountedPrice * product.quantity;

        const allProductsCancelled = order.products.every(p => p.status === "Cancelled");

        if (allProductsCancelled) {
            order.status = "Cancelled";

            if (order.couponDiscount > 0) {
                refundAmount -= order.couponDiscount;
            }
        }
        if (order.paymentMethod === 'Razorpay' || order.paymentMethod === 'Wallet') {

            if (!wallet) {
                wallet = new walletModel({
                    userId: order.userId,
                    balance: refundAmount,
                    transactions: [
                        {
                            type: 'refund',
                            amount: refundAmount,
                            description: `Refund for canceled product (${product.name}) in order ${orderId}`
                        }
                    ]
                });
            } else {
                wallet.balance += refundAmount;
                wallet.transactions.push({
                    type: 'refund',
                    amount: refundAmount,
                    description: `Refund for canceled product (${product.name}) in order ${orderId}`
                });
            }
        }

        await wallet.save();
        await order.save();

        res.redirect("/admin/orders");

    } catch (error) {
        console.error("Error in admin cancelOrder:", error);
        if (error.name === 'ValidationError') {
            return res.status(400).json({ error: 'Validation Error' });
        }
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

const updateProductStatus = async (req, res) => {
    const { orderId, productId } = req.params;
    const { status } = req.body;

    if (!["Pending", "Shipped", "Delivered", "Cancelled"].includes(status)) {
        return res.status(400).send("Invalid status");
    }

    try {
        const order = await orderModel.findById(orderId);

        if (!order) {
            return res.status(404).send("Order not found");
        }

        const currentProduct = await productModel.findById(productId);
        const product = order.products.find(p => p.productId.toString() === productId);

        if (!product) {
            return res.status(404).send("Product not found in order");
        }

        product.status = status;

        if (status === 'Cancelled') {
            currentProduct.stock += product.quantity;
            await currentProduct.save();

            let refundAmount = product.discountedPrice * product.quantity;

            const allProductCancelled = order.products.every(e => e.status === "Cancelled");

            if (allProductCancelled) {
                order.status = "Cancelled";

                if (order.couponDiscount > 0) {
                    refundAmount -= order.couponDiscount;
                }
            }

            let wallet = await walletModel.findOne({ userId: order.userId });
            if (order.paymentMethod === "Razorpay" || order.paymentMethod === "Wallet") {
                if (!wallet) {
                    wallet = new walletModel({
                        userId: order.userId,
                        balance: refundAmount,
                        transactions: [
                            {
                                type: 'refund',
                                amount: refundAmount,
                                description: `Refund for canceled product (${product.name}) in order ${orderId}`
                            }
                        ]
                    });
                } else {
                    wallet.balance += refundAmount;
                    wallet.transactions.push({
                        type: 'refund',
                        amount: refundAmount,
                        description: `Refund for canceled product (${product.name}) in order ${orderId}`
                    });
                }
            }
            await wallet.save();
        } else {
            currentProduct.stock += product.quantity;
            await currentProduct.save();
        }

        const allProductCancelled = order.products.every(e => e.status === "Cancelled");

        if (allProductCancelled) {
            order.status = "Cancelled";
        } else if (order.products.some(e => e.status === "Pending")) {
            order.status = "Pending";
        } else if (order.products.some(e => e.status === "Shipped")) {
            order.status = "Shipped";
        } else if (order.products.every(e => e.status === "Delivered")) {
            order.status = "Delivered";
        }

        await order.save();

        res.redirect("/admin/orders");
    } catch (error) {
        console.error("Error updating product status:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
};

const orderDetails = async (req, res) => {
    const { orderId } = req.params;
    try {
        const order = await orderModel.findById(orderId).populate("address").populate("products.productId").exec()
        res.render("admin/orderDetails", { order })
    } catch (error) {
        res.send(error)
    }
};


module.exports = {
    loadOrder,
    cancelOrder,
    updateProductStatus,
    orderDetails
}