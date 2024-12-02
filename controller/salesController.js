const crypto = require("crypto")
const Razorpay = require('razorpay');
const cartModel = require("../Model/cartModel")
const productModel = require("../Model/productModel")
const addressModel = require("../Model/addressModel")
const orderModel = require("../Model/orderModel")
const couponModel = require("../Model/couponModel")
require('dotenv').config();


const loadCart = async (req, res) => {
    try {
        const userId = req.session.user
        const product = await cartModel.findOne({ userId }).populate("products.productId").exec();
        if (!product) {
            return res.render("user/cart", { message: "Your cart is empty." });
        }

        const listedProducts = product.products.filter(item => item.productId.isListed);

        if (listedProducts.length !== product.products.length) {
            product.products = listedProducts;
            await product.save();
        }

        if (product.products.length === 0) {
            return res.render("user/cart", { message: "All products in your cart are no longer available." });
        }
        res.render("user/cart", { product })

    } catch (error) {
        console.error("Error loading cart:", error);
        res.status(500).send("An error occurred while loading the cart.");
    }
}

const addCart = async (req, res) => {
    const productId = req.params.id;
    const userId = req.session.user;

    try {
        let cart = await cartModel.findOne({ userId }).populate("products.productId").exec();

        const product = await productModel.findById(productId).populate('offer');

        if (!product) {
            return res.status(404).send('Product not found');
        }

        if (!product.isListed) {
            return res.status(400).send('This product is no longer available for purchase.');
        }

        let priceToAdd = product.price;
        let discountedPrice = null;

        if (product.offer && product.offer.isActive) {
            if (product.offer.discountType === 'percentage') {
                const discount = (product.price * product.offer.discountValue) / 100;
                discountedPrice = product.price - discount;
                priceToAdd = discountedPrice;
            } else if (product.offer.discountType === 'fixed') {
                discountedPrice = product.price - product.offer.discountValue;
                priceToAdd = discountedPrice;
            }
        }

        if (!cart) {
            cart = new cartModel({
                userId,
                products: [
                    {
                        productId,
                        quantity: 1,
                        price: priceToAdd,
                        discountedPrice: discountedPrice
                    }
                ]
            });
        } else {
            const existingProductIndex = cart.products.findIndex(
                (item) => item.productId._id.toString() === productId.toString()
            );

            if (existingProductIndex > -1) {
                cart.products[existingProductIndex].quantity += 1;
            } else {
                if (product.stock < 1) {
                    return res.status(400).send('Product out of stock');
                }

                cart.products.push({
                    productId,
                    quantity: 1,
                    price: product.price, // Store the price in the cart
                    discountedPrice: discountedPrice // Optionally store discounted price
                });
            }
        }

        const newStock = product.stock - 1;
        await productModel.findByIdAndUpdate(productId, { stock: newStock });

        // Save the cart to the database
        await cart.save();
        res.redirect("/cart");

    } catch (error) {
        console.error(error);
        res.status(500).send('Server error');
    }
}

const updateCartQuantity = async (req, res) => {
    try {
        const { productId, quantity } = req.body;
        const userId = req.session.user;

        if (quantity < 1) {
            return res.status(400).json({ success: false, message: 'Quantity must be at least 1' });
        }

        const cart = await cartModel.findOne({ userId }).populate('products.productId').exec();

        if (!cart) {
            return res.status(404).json({ success: false, message: 'Cart not found' });
        }

        const productIndex = cart.products.findIndex(item => item.productId._id.toString() === productId);

        if (productIndex === -1) {
            return res.status(404).json({ success: false, message: 'Product not found in cart' });
        }

        const product = cart.products[productIndex].productId;

        const availableStock = product.stock;
        const currentQuantity = cart.products[productIndex].quantity;
        const quantityDifference = quantity - currentQuantity;

        if (quantity > availableStock + currentQuantity - 1) {
            return res.json({
                success: false,
                message: `Only ${availableStock + currentQuantity - 1} units available for this product`
            });
        }

        cart.products[productIndex].quantity = quantity;

        const newStock = availableStock - quantityDifference;
        await productModel.findByIdAndUpdate(productId, { stock: newStock });

        await cart.save();

        const updatedPrice = product.price * quantity;

        res.json({ success: true, newPrice: updatedPrice });

    } catch (error) {
        console.error('Error updating cart quantity:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
}

const cancelProduct = async (req, res) => {
    try {
        const { productId } = req.params;
        const userId = req.session.user;

        const cart = await cartModel.findOne({ userId }).populate('products.productId').exec();

        if (!cart) {
            return res.status(404).json({ success: false, message: 'Cart not found' });
        }

        const productIndex = cart.products.findIndex(item => item.productId._id.toString() === productId);

        if (productIndex === -1) {
            return res.status(404).json({ success: false, message: 'Product not found in cart' });
        }

        const product = cart.products[productIndex].productId;
        const quantityToRemove = cart.products[productIndex].quantity;

        const newStock = product.stock + quantityToRemove;
        await productModel.findByIdAndUpdate(productId, { stock: newStock });

        cart.products.splice(productIndex, 1);

        if (cart.products.length === 0) {
            await cartModel.deleteOne({ _id: cart._id });
            return res.json({ success: true, message: 'Cart deleted as no products are left' });
        } else {
            await cart.save();
            return res.json({ success: true, message: 'Product removed from cart and stock updated' });
        }

    } catch (error) {
        console.error('Error canceling product:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

const loadCheckout = async (req, res) => {
    const id = req.session.user
    try {
        const coupons = await couponModel.find()
        const addresses = await addressModel.find({ user: id })
        const cart = await cartModel.findOne({ userId: id }).populate("products.productId").exec()
           
        if (!cart || cart.products.length === 0) {
            return res.redirect("/cart?message=Your cart is empty. Add products to proceed to checkout.");
        }

        const validProducts = cart.products.filter(item => item.productId.isListed);

        if (validProducts.length < cart.products.length) {
            cart.products = validProducts;
            await cart.save();

            return res.redirect("/cart?message=Some unlisted products were removed from your cart. Proceed to checkout.");
        }

        let subtotal = 0;
        cart.products.forEach((item) => {
            const price = item.discountedPrice ? item.discountedPrice : item.price;
            subtotal += price * item.quantity;
        });
        const shippingCost = 50;
        const total = subtotal + shippingCost


        res.render("user/checkout", { coupons, addresses, cart, subtotal, shippingCost, total })
    } catch (error) {
        console.error(error);
        res.status(500).send('Server error');
    }
}

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

        res.redirect("/checkout")
    } catch (error) {
        console.error(error);
        res.status(500).send('Error updating address');
    }
}

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
        res.redirect("/checkout");

    } catch (error) {
        console.error("Error saving address:", error);
        res.status(500).send("Failed to save address");
    }
}

const loadOrderSuccess = async (req, res) => {
    try {
        res.render("user/orderSuccess")
    } catch (error) {
        res.send(error)
    }
}

const saveOrder = async (req, res) => {
    const userId = req.session.user;
    const { addressId, cartItems, subtotal, shippingCost, total, paymentMethod, couponCode, paymentStatus, paymentDetails } = req.body;

    if (isNaN(total) || total <= 0) {
        return res.status(400).json({ error: 'Invalid total amount.' });
    }

    let finalTotal = total;

    if (couponCode) {
        try {
            const coupon = await couponModel.findOne({ code: couponCode });

            if (!coupon) {
                return res.status(400).json({ error: 'Invalid coupon code' });
            }

            if (coupon.discountType === 'percentage') {
                finalTotal = total - (total * coupon.discountValue / 100);
            } else if (coupon.discountType === 'fixed') {
                finalTotal = total - coupon.discountValue;
            }

            if (finalTotal < 0) {
                finalTotal = 0;
            }

        } catch (error) {
            return res.status(500).json({ error: 'Error applying coupon' });
        }
    }

    const orderProducts = cartItems.map(item => {
        const discountedPrice = item.discountedPrice || item.price;
        return {
            productId: item.productId,
            quantity: item.quantity,
            name: item.name,
            price: item.price,
            discountedPrice: discountedPrice,
            status: item.status
        };
    });

    const finalPaymentStatus = paymentStatus || 'Pending';

    const newOrder = new orderModel({
        userId: userId,
        address: addressId,
        products: orderProducts,
        subtotal: subtotal,
        shippingCost: shippingCost,
        total: finalTotal,
        paymentMethod: paymentMethod,
        paymentStatus: finalPaymentStatus,
        paymentDetails: paymentDetails || {},
        orderDate: new Date()
    });

    try {
        const order = await newOrder.save();

        await cartModel.findOneAndUpdate(
            { userId: userId },
            { $pull: { products: { productId: { $in: cartItems.map(item => item.productId) } } } },
            { new: true }
        );

        if (paymentStatus === 'Paid') {
            await orderModel.findByIdAndUpdate(order._id, { paymentStatus: 'Completed' });
        } else if (paymentStatus === 'Failed') {
            await orderModel.findByIdAndUpdate(order._id, { paymentStatus: 'Failed' });
        }

        res.status(200).json({ message: 'Order placed successfully', orderId: order._id });

    } catch (error) {
        console.error('Error saving order:', error);
        res.status(500).json({ error: 'Failed to place order' });
    }
};

const instance = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_SECRET_KEY
});

const createRazorpayOrder = async (req, res) => {
    const { total, totalAfterDiscount } = req.body;

    try {
        const finalAmount = totalAfterDiscount
            ? parseFloat(totalAfterDiscount)
            : parseFloat(total);

        const options = {
            amount: finalAmount * 100,
            currency: "INR",
            receipt: "order_receipt_" + new Date().getTime(),
            payment_capture: 1
        };

        const order = await instance.orders.create(options);
        res.json({
            orderId: order.id,
            amount: options.amount
        });
    } catch (error) {
        console.error('Error creating Razorpay order:', error);
        res.status(500).json({ error: 'Failed to create Razorpay order' });
    }
};

const paymentFailer = async (req, res) => {
    const { orderId, paymentStatus } = req.body;

    try {
        const order = await orderModel.findById(orderId);
        if (!order) {
            return res.status(404).json({ error: 'Order not found' });
        }

        order.paymentStatus = paymentStatus;
        await order.save();

        res.status(200).json({ message: 'Payment status updated successfully' });
    } catch (error) {
        console.error('Error updating payment status:', error);
        res.status(500).json({ error: 'Failed to update payment status' });
    }
}

const applyCoupon = async (req, res) => {
    const { couponCode, subtotal } = req.body

    try {
        const trimmedCouponCode = couponCode.trim();

        const coupon = await couponModel.findOne({ code: trimmedCouponCode })


        if (!coupon || new Date(coupon.expiryDate) < new Date()) {
            return res.status(400).json({ message: 'Invalid or expired coupon code.' });
        }

        let discount = 0;

        if (coupon.discountType === 'percentage') {
            discount = (coupon.discountValue / 100) * subtotal;
        } else if (coupon.discountType === 'fixed') {
            discount = coupon.discountValue;
        }

        if (coupon.maxDiscount && discount > coupon.maxDiscount) {
            return res.status(400).json({
                message: `No discount applied. Maximum discount allowed for this coupon is ₹${coupon.maxDiscount}.`,
            });
        }

        const newTotal = subtotal - discount;

        return res.status(200).json({
            success: true,
            message: 'Coupon applied successfully!',
            discount: discount.toFixed(2),
            newTotal: newTotal.toFixed(2)
        });

    } catch (error) {
        console.error('Detailed Error:', {
            couponCode,
            subtotal,
            coupon,
            error: error.message,
        });
        return res.status(500).json({ message: 'Server error. Please try again.' });
    }
}


module.exports = {
    loadCart,
    addCart,
    cancelProduct,
    loadCheckout,
    updateAddress,
    saveAddress,
    loadOrderSuccess,
    saveOrder,
    updateCartQuantity,
    createRazorpayOrder,
    applyCoupon,
    paymentFailer
}