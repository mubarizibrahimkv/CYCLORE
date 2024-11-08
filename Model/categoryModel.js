const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
    },
    variant: {
        type: String,
        trim: true,
    },
    isListed: {
        type: Boolean,
        default: true, 
    },
});


module.exports = mongoose.model('Category', categorySchema);
