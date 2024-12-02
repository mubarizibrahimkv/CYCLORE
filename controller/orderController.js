const orderModel = require("../Model/orderModel")


const loadOrder = async (req, res) => {
    const { page = 1, limit = 10 } = req.query;

    try {
        const orders = await orderModel.find()
            .sort({ createdAt: -1 }).populate("userId")
            .populate("products.productId")
            .skip((page - 1) * limit)
            .limit(Number(limit)).exec();

        const totalOrders = await orderModel.countDocuments();

        res.render("admin/orders", {
            orders,
            currentPage: Number(page),
            totalPages: Math.ceil(totalOrders / limit),
            totalOrders
        })
        
    } catch (error) {
        console.error(error);
        res.send("Error fetching order");
    }
}



const cancelOrder = async (req, res) => {
    const { orderId, productId } = req.params;

    try {
        const order = await orderModel.findById(orderId)

        if (!order) {
            return res.status(404).send('Order not found');
        }

        const product = order.products.find(p => p.productId.toString() === productId);

        if (!product) {
            return res.status(404).send('Product not found');
        }

        product.status = 'Cancelled';

        const allProductCancelled = order.products.every(e => e.status === "Cancelled");

        if (allProductCancelled) {
            order.status = "Cancelled";
        }

        await order.save();
        res.redirect("/admin/orders");

    } catch (error) {
        console.error("Error in changeStatus:", error);
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

        const product = order.products.find(p => p.productId.toString() === productId);

        if (!product) {
            return res.status(404).send("Product not found in order");
        }

        product.status = status;

        const allProductCancelled = order.products.every(e => e.status === "Cancelled");

        if (allProductCancelled) {
            order.status = "Cancelled";
        }else{
            order.status=status
        }

        await order.save();

        res.redirect("/admin/orders");
    } catch (error) {
        console.error("Error updating product status:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
};




module.exports = {
    loadOrder,
    cancelOrder,
    updateProductStatus
}