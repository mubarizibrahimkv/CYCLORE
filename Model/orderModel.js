const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.ObjectId,
        ref: 'user',
        required: true
    },
    products: [{
        productId: {
            type: mongoose.Schema.ObjectId,
            ref: 'Product',
            required: true
        },
        quantity: {
            type: Number,
            requried: true
        },
        name: {
            type: String,
            required: true
        },
        price: {
            type: Number,
            required: true
        },
        discountedPrice: {
            type: Number,  
            required: false
        },
        status: {
            type: String,
            enum: ['Pending', 'Shipped', 'Delivered', 'Cancelled'],
            default: 'Pending'
        }
    }
    ],
    address: {
        type: mongoose.Schema.ObjectId,
        ref: 'Address',
        required: true
    },
    total: {
        type: Number,
        required: true
    },
    status: {
        type: String,
        enum: ['Pending', 'Shipped', 'Delivered', 'Cancelled'],
        default: 'Pending'
    },
    paymentMethod: {
        type: String,
        enum: ['CashOnDelivery', "Razorpay", "Wallet"],
        default: "CashOnDelivery"
    },
    shippingCost: {
        type: Number,
        required: true
    },
    couponCode: {
        type: String,
        default: ''
    },
    discountAmount: {
        type: Number
    },
    paymentStatus: {
        type: String,
        enum: ['Pending', 'Completed', 'Failed'],
        default: 'Pending'
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }

}, { timestamps: true });

const orderModel = mongoose.model('order', orderSchema);
module.exports = orderModel;