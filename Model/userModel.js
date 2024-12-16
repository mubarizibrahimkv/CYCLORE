const mongoose = require("mongoose")

const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: false
    },
    email: {
        type: String,
        required: true,
        unique: true
    },
    password:
    {
        type: String,
        required: false
    },
    phone: {
        type: String,
        required: false,
        unique:true,
        sparse:true,
        default:null
    },
    usedCoupons: [
        {
            couponId: {
                 type: mongoose.Schema.Types.ObjectId,
                  ref: 'Coupon' 
                },
            usedAt: {
                 type: Date,
                  default: Date.now 
                },
        }
    ],
    googleId:{
      type:String,
      required:false
    },
    status: {
        type: Boolean,
        default: true
    }
}); 

module.exports = mongoose.model("user", userSchema)

