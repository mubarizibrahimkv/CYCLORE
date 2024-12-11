const orderModel = require("../Model/orderModel")


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
        } else if (order.products.some(e => e.status === "Pending")) {
            order.status = "Pending";
        } else if (order.products.some(e => e.status === "Shipped")) {
            order.status = "Shipped";
        }else if (order.products.every(e => e.status === "Delivered")) {
            order.status = "Delivered";
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
}

const orderDetails=async (req,res)=>{
    const {orderId}=req.params;    
    try {
        const order=await orderModel.findById(orderId).populate("address").populate("products.productId").exec()        
        res.render("admin/orderDetails",{order})
    } catch (error) {
        res.send(error)
    }
}


module.exports = {
    loadOrder,
    cancelOrder,
    updateProductStatus,
    orderDetails
}