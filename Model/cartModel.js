const mongoose = require("mongoose");

const cartSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "user",
            required: true
        },
        products: [
            {
                productId: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "Product",
                    required: true
                },
                quantity: {
                    type: Number,
                    required: true,
                    default: 1
                },
                price: {
                    type: Number,  
                    required: true
                },
                discountedPrice: {
                    type: Number,  
                    required: false
                }
            }
        ]
    },
    { timestamps: true }
);

module.exports = mongoose.model("cart", cartSchema);
