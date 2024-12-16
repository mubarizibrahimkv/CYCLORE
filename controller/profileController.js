const addressModel = require("../Model/addressModel")
const userModel = require("../Model/userModel")
const orderModel = require("../Model/orderModel")
const wishlistModel = require("../Model/wishlistModel")
const productModel = require("../Model/productModel")
const bcrypt = require("bcrypt")
const walletModel = require("../Model/walletModel")
const Razorpay = require('razorpay');
require('dotenv').config();


const loadProfile = async (req, res) => {
    const id = req.session.user
    try {
        const user = await userModel.findOne({ _id: id });
        const addresses = await addressModel.find({ user: id, isListed: true })
        const isGoogleUser = !!user.googleId;
        res.render("user/profile", { user, addresses, isGoogleUser })
    } catch (error) {
        res.send(error)
    }
};

const userLogout = async (req, res) => {
    try {
        delete req.session.user;
        res.clearCookie('connect.sid');
        console.log("User logged out successfully.");
        res.redirect('/');
    } catch (error) {
        console.error('Error during logout:', error);
        res.status(500).json({ success: false, message: 'An error occurred while logging out' });
    }
};

const saveAddress = async (req, res) => {
    try {
        const { firstName, lastName, email, mobile, address, country, city, state, pinCode, } = req.body;
        const userId = req.session.user;
        if (!userId) {
            return res.status(400).send("User ID is required.");
        }
        const profile = new addressModel({
            user: userId,
            firstName,
            lastName,
            email,
            mobile,
            address,
            country,
            city,
            state,
            pinCode,
        });

        await profile.save();
        res.redirect("/profile");

    } catch (error) {
        console.error("Error saving address:", error);
        res.status(500).send("Failed to save address");
    }
};

const updateAddress = async (req, res) => {
    const { id, firstName, lastName, mobile, email, address, country, city, state, pinCode } = req.body;
    try {
        const updatedAddress = await addressModel.findByIdAndUpdate(id, {
            firstName,
            lastName,
            mobile,
            email,
            address,
            country,
            city,
            state,
            pinCode
        }, { new: true })

        if (!updatedAddress) {
            console.log("Address not found or not updated.");
            return res.status(404).send("Address not found");
        }

        res.redirect("/profile")
    } catch (error) {
        console.error(error);
        res.status(500).send('Error updating address');
    }
};

const deleteAddress = async (req, res) => {
    const addressId = req.params.id
    try {
        await addressModel.findByIdAndUpdate(addressId, { isListed: false })
        res.redirect("/profile")
    } catch (error) {
        console.error(error);
        res.status(500).send('Error deleting address');
    }
};

const loadOrder = async (req, res) => {
    const userId = req.session.user;
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const skip = (page - 1) * limit;

    try {
        const [orders, totalOrders] = await Promise.all([
            orderModel.find({ userId })
                .skip(skip)
                .limit(limit)
                .sort({ createdAt: -1 })
                .populate("userId")
                .populate("products.productId")
                .exec(),
            orderModel.countDocuments({ userId })
        ]);

        const totalPages = Math.ceil(totalOrders / limit);
        const pageNumbers = [];

        for (let i = 1; i <= totalPages; i++) {
            pageNumbers.push(i);
        }

        res.render("user/myOrder", {
            order: orders,
            currentPage: page,
            totalPages: totalPages,
            pageNumbers: pageNumbers
        });
    } catch (error) {
        console.error(error);
        res.send("Error loading orders");
    }
};

const razorpayInstance = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_SECRET_KEY,
});

const retryPayment = async (req, res) => {
    const { orderId } = req.params;

    try {
        const order = await orderModel.findById(orderId);
        if (!order) {
            return res.status(404).json({ error: 'Order not found' });
        }

        const razorpayOrder = await razorpayInstance.orders.create({
            amount: order.total * 100,
            currency: 'INR',
            receipt: orderId,
            payment_capture: 1,
        });

        order.paymentStatus = 'Pending';
        order.paymentDetails = {};
        await order.save();

        res.status(200).json({
            orderId: razorpayOrder.id,
            amount: razorpayOrder.amount,
        });
    } catch (error) {
        console.error('Error retrying payment:', error.message || error);
        res.status(500).json({
            error: 'Failed to retry payment',
            message: error.message,
        });
    }
};

const retryPaymentSuccess = async (req, res) => {
    try {
        const order = await orderModel.findById(req.body.orderId);

        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        return res.status(200).json({ message: 'Order placed successfully' });

    } catch (error) {
        res.status(500).json({ message: 'Failed to place order. Please try again.' });
    }
};

const updatePaymentFailure = async (req, res) => {
    const { orderId } = req.params;

    try {
        const order = await orderModel.findById(orderId);

        if (!order) {
            return res.status(404).json({ error: 'Order not found' });
        }

        order.paymentStatus = 'Failed';
        await order.save();

        res.status(200).json({ message: 'Payment status updated to Failed' });
    } catch (error) {
        console.error('Error updating payment status:', error.message || error);
        res.status(500).json({
            error: 'Failed to update payment status',
            message: error.message,
        });
    }
};

const cancelOrder = async (req, res) => {
    const { orderId, productId } = req.params;
    const { cancellationReason } = req.body;

    try {
        const order = await orderModel.findById(orderId);
        if (!order) {
            return res.status(404).send('Order not found');
        }

        const product = order.products.find(p => p.productId.toString() === productId);

        const currentProduct = await productModel.findById(productId)
        if (!product) {
            return res.status(404).send('Product not found');
        }


        product.status = 'Cancelled';
        currentProduct.stock += product.quantity
        currentProduct.save();
        product.cancellationReason = cancellationReason;

        order.total -= product.discountedPrice;

        const allProductsCancelled = order.products.every((p) => p.status === "Cancelled");
        let refundAmount = product.discountedPrice * product.quantity;

        let wallet = await walletModel.findOne({ userId: order.userId });
        if (allProductsCancelled) {
            order.status = "Cancelled";
            if (order.couponDiscount > 0) {
                refundAmount -= order.couponDiscount;
                order.total += order.couponDiscount;
            }
        }

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
        await order.save();

        res.redirect('/profile/order');
    } catch (error) {
        console.error('Error canceling order:', error);
        res.status(500).send('Error updating order status');
    }
};

const changePassword = async (req, res) => {
    const { currentPassword, newPassword, confirmPassword } = req.body;
    const userId = req.session.user;

    if (!currentPassword || !newPassword || !confirmPassword) {
        return res.render("user/profile", {
            message: 'All fields are required',
            showModal: true
        });
    }

    if (newPassword === currentPassword) {
        return res.render("user/profile", {
            message: "The new password cannot be the same as the current password. Please choose a different password.",
            showModal: true
        })
    }

    if (newPassword.length < 8) {
        return res.render("user/profile", {
            message: 'Password must be at least 8 characters long',
            showModal: true
        });
    }

    try {
        const user = await userModel.findById(userId);
        if (!user) {
            return res.render("user/profile", {
                message: 'User not found',
                showModal: true
            });
        }

        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
            return res.render("user/profile", {
                message: 'Current password is incorrect',
                showModal: true
            });
        }

        if (newPassword !== confirmPassword) {
            return res.render("user/profile", {
                message: 'New passwords do not match',
                showModal: true
            });
        }

        const passwordHash = await bcrypt.hash(newPassword, 10);
        user.password = passwordHash;
        await user.save();

        return res.render("user/profile", {
            success: 'Password changed successfully!',
            showModal: true
        });
    } catch (error) {
        console.error(error);
        return res.render("user/profile", {
            message: 'An error occurred',
            error,
            showModal: true
        });
    }
};

const loadViewDetails = async (req, res) => {
    try {
        const { orderId, productId } = req.params;

        const order = await orderModel.findById(orderId).populate("userId").populate("products.productId").populate("address");

        if (!order) {
            return res.status(404).send("Order not found");
        }
        const product = order.products.find(item => item.productId._id.toString() === productId);

        if (!product) {
            return res.status(404).send("Product not found in this order");
        }
        res.render("user/orderDetails", { order, product });
    } catch (error) {
        res.status(500).send(error);
    }
};

const loadWishlist = async (req, res) => {
    const userId = req.session.user;
    try {
        const wishlist = await wishlistModel
            .findOne({ userId })
            .populate({
                path: "products.productId",
                match: { isListed: true },
            });

        if (!wishlist || wishlist.products.length === 0) {
            return res.render("user/wishlist", { wishlist: { products: [] } });
        }
        wishlist.products = wishlist.products.filter(product => product.productId);
        res.render("user/wishlist", { wishlist });
    } catch (error) {
        console.error("Error loading wishlist:", error);
        res.status(500).send("Internal Server Error");
    }
};

const addWishlist = async (req, res) => {
    const productId = req.params.id
    const userId = req.session.user
    try {
        const product = await productModel.findById(productId);
        if (!product) {
            return res.status(404).json({ message: "Product not found" });
        }

        let wishlist = await wishlistModel.findOne({ userId });

        if (!wishlist) {
            wishlist = new wishlistModel({ userId, products: [] });
        }

        const isProductInWishlist = wishlist.products.some((item) =>
            item.productId.equals(productId)
        );

        if (isProductInWishlist) {
            res.redirect("/shop")
        }

        wishlist.products.push({
            productId: product._id,
            name: product.name,
            price: product.price,
            image: product.images[0]
        });

        await wishlist.save();

        res.redirect("/wishlist")
    } catch (error) {
        console.error("Error adding product to wishlist:", error);
        if (!res.headersSent) {
            return res.status(500).json({ message: "Internal server error" });
        }
        return res.status(500).json({ message: "Internal server error" });


    }
};

const removeWishlist = async (req, res) => {
    const productId = req.params.id;
    const userId = req.session.user;

    try {

        const wishlist = await wishlistModel.findOne({ userId });

        if (!wishlist) {
            return res.status(404).json({ message: "Wishlist not found" });
        }

        const initialProductCount = wishlist.products.length;

        wishlist.products = wishlist.products.filter(
            (item) => !item.productId.equals(productId)
        );

        if (wishlist.products.length === initialProductCount) {
            return res.status(404).json({ message: "Product not found in wishlist" });
        }

        await wishlist.save();

        res.redirect("/wishlist")
    } catch (error) {
        console.error("Error removing product from wishlist:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

const loadWallet = async (req, res) => {
    try {
        const userId = req.session.user;

        const wallet = await walletModel.findOne({ userId });

        if (!wallet) {
            return res.render('user/wallet', { wallet: null });
        }

        const page = parseInt(req.query.page) || 1;
        const limit = 10;
        const skip = (page - 1) * limit;

        const sortedTransactions = wallet.transactions.sort((a, b) => {
            return new Date(b.date) - new Date(a.date);
        });

        const transactions = sortedTransactions.slice(skip, skip + limit);
        const totalTransactions = sortedTransactions.length;
        const totalPages = Math.ceil(totalTransactions / limit);

        res.render('user/wallet', {
            wallet: {
                ...wallet.toObject(),
                transactions,
            },
            currentPage: page,
            totalPages,
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('Server Error');
    }
};

const returnProduct = async (req, res) => {
    const { orderId, productId } = req.params;
    const { reason } = req.body;
    try {
        const order = await orderModel.findById(orderId);
        if (!order) {
            return res.status(404).send('Order not found');
        }

        const product = order.products.find(p => p.productId.toString() === productId);
        if (!product) {
            return res.status(404).send('Product not found');
        }

        product.status = "Returned";
        product.returnReason = reason;
        order.total -= product.discountedPrice;

        let refundAmount = product.discountedPrice * product.quantity;

        const lastProduct = order.products[order.products.length - 1];
        const isLastProductReturned = lastProduct.productId.toString() === productId;


        if (isLastProductReturned) {
            if (order.couponDiscount > 0) {
                refundAmount -= order.couponDiscount;
                order.total += order.couponDiscount;
            }
        }

        let wallet = await walletModel.findOne({ userId: order.userId });

        if (!wallet) {
            wallet = new walletModel({
                userId: order.userId,
                balance: refundAmount,
                transactions: [
                    {
                        type: 'refund',
                        amount: refundAmount,
                        description: `Refund for returned product (${product.name}) in order ${orderId}`
                    }
                ]
            });
        } else {
            wallet.balance += refundAmount;
            wallet.transactions.push({
                type: 'refund',
                amount: refundAmount,
                description: `Refund for returned product (${product.name}) in order ${orderId}`
            });
        }

        await wallet.save();
        await order.save();

        res.status(200).json({ success: true, message: 'Product returned successfully and refund processed.' });
    } catch (error) {
        console.error('Error returning product:', error);
        res.status(500).json({ success: false, message: 'An error occurred while processing the return.' });
    }
};

module.exports = {
    loadProfile,
    userLogout,
    saveAddress,
    updateAddress,
    deleteAddress,
    loadOrder,
    retryPayment,
    cancelOrder,
    changePassword,
    loadViewDetails,
    loadWishlist,
    loadWallet,
    addWishlist,
    removeWishlist,
    returnProduct,
    retryPaymentSuccess,
    updatePaymentFailure
}