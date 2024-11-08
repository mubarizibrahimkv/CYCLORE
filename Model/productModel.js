const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    category: {
        type: String,
        required: true,
        trim: true
    },
    price: {
        type: Number,
        required: true,
        min: 0
    },
    stock: {
        type: Number,
        required: true,
        min: 0
    },
    description: {
        type: String,
        required: true,
        trim: true
    },
    images: {
         type: [String],
         required: false
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    isListed: {
        type: Boolean,
        default: true, 
    }
});

module.exports = mongoose.model('Product', productSchema);
