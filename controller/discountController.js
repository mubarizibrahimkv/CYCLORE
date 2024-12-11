const couponModel = require("../Model/couponModel")
const offerModel = require("../Model/offerModel")
const productModel = require("../Model/productModel")
const categoryModel = require("../Model/categoryModel")
const mongoose = require("mongoose")


const loadCoupon = async (req, res) => {
    try {
        const coupons = await couponModel.find()
        res.render("admin/coupon", { coupons })
    } catch (error) {
        res.send(error)
    }
}

const addCoupon = async (req, res) => {
    try {
        const { code, discountType, discountValue, minPurchase, maxDiscount, expiryDate } = req.body;

        if (!code || !discountType || !discountValue || !minPurchase || !maxDiscount || !expiryDate) {
            return res.status(400).send('All fields are required');
        }

        if (discountType === "percentage") {
            if (discountValue > 100) {
                return res.status(400).send('Discount values must be below 100');
            }
        }


        const currentDate = new Date();
        const parsedExpiryDate = new Date(expiryDate);
        if (parsedExpiryDate <= currentDate) {
            return res.status(400).send('Expiry date must be in the future');
        }

        const newCoupon = new couponModel({
            code,
            discountType,
            discountValue,
            minPurchase,
            maxDiscount,
            expiryDate,
        });

        await newCoupon.save();
        res.redirect('/admin/coupon');
    } catch (error) {
        console.error(error);
        res.status(500).send('Error adding coupon');
    }
};

const deleteCoupon = async (req, res) => {
    const couponId = req.params.id
    try {
        await couponModel.findByIdAndDelete(couponId)
        res.redirect("/admin/coupon")
    } catch (error) {
        console.error(error);
        res.status(500).send('Error deactivating coupon')
    }
}

const editCoupon = async (req, res) => {
    const id = req.params.id;
    const { code, discountType, discountValue, minPurchase, maxDiscount, expiryDate } = req.body;

    try {
        if (!code || !discountType || !discountValue || !minPurchase || !maxDiscount || !expiryDate) {
            return res.status(400).send('All fields are required');
        }

        if (discountType === "percentage") {
            if (discountValue > 100) {
                return res.status(400).send('Discount values must be below 100');
            }
        }

        const currentDate = new Date();
        const parsedExpiryDate = new Date(expiryDate);
        if (parsedExpiryDate <= currentDate) {
            return res.status(400).send('Expiry date must be in the future');
        }

        const coupon = await couponModel.findById(id);
        if (!coupon) {
            return res.status(404).send('Coupon not found');
        }

        await couponModel.findByIdAndUpdate(id, {
            code,
            discountType,
            discountValue,
            minPurchase,
            maxDiscount,
            expiryDate,
        });

        res.redirect("/admin/coupon");
    } catch (error) {
        console.error('Error editing coupon:', error);
        res.status(500).send('Error editing coupon');
    }
};

const loadOffer = async (req, res) => {
    try {
        const offers = await offerModel.find()
        const products = await productModel.find()
        const categories = await categoryModel.find()
        const offerss = await offerModel
            .find()
            .populate('products', 'name _id')
            .populate('categories', 'name _id');
        res.render("admin/offer", { offers, products, categories, offerss })
    } catch (error) {
        res.status(500).send("Failed to render page.Please try again")
    }
}

const addOffer = async (req, res) => {
    const {
        offerName,
        applicableTo,
        applicableToId,
        products,
        categories,
        discountType,
        discountValue,
        expiryDate,
    } = req.body;

    try {
        if (!offerName || !applicableTo || !discountType || !discountValue || !expiryDate) {
            return res.status(400).send('All fields are required.');
        }

        if (discountValue > 100 || discountValue < 0) {
            return res.status(400).send('Discount value must be between 0 and 100.');
        }

        const parsedExpiryDate = new Date(expiryDate);
        if (isNaN(parsedExpiryDate) || parsedExpiryDate <= new Date()) {
            return res.status(400).send('Expiry date must be a valid future date.');
        }

        if (applicableTo === 'Product' && (!products || products.length === 0)) {
            return res.status(400).send('At least one product must be selected.');
        }

        if (applicableTo === 'Category' && (!categories || categories.length === 0)) {
            return res.status(400).send('At least one category must be selected.');
        }

        const newOffer = new offerModel({
            offerName,
            applicableTo,
            applicableToId,
            discountType,
            discountValue,
            expiryDate,
            products: applicableTo === 'Product' ? products || [] : [],
            categories: applicableTo === 'Category' ? categories || [] : [],
        });

        await newOffer.save();

        if (applicableTo === 'Product') {
            await productModel.updateMany(
                { _id: { $in: products } },
                { $set: { offer: newOffer._id } }
            );
        }

        if (applicableTo === 'Category') {
            const categoryIds = categories.map(id => new mongoose.Types.ObjectId(id));
            const productsInCategories = await productModel.find({ categories: { $in: categoryIds } });

            if (!productsInCategories.length) {
                return res.status(404).send('No products found for the selected categories.');
            }

            await productModel.updateMany(
                { _id: { $in: productsInCategories.map(product => product._id) } },
                { $set: { offer: newOffer._id } }
            );

            newOffer.products = productsInCategories.map(product => product._id);
            await newOffer.save();
        }

        res.redirect('/admin/offer');
    } catch (error) {
        console.error('Error saving offer:', error.message);
        res.status(500).send('Error saving offer. Please try again later.');
    }
};

const editOffer = async (req, res) => {
    const offerId = req.params.id;
    const {
        offerName,
        applicableTo,
        products,
        categories,
        discountType,
        discountValue,
        expiryDate,
    } = req.body;

    try {
        if (!offerName || !applicableTo || !discountType || !discountValue || !expiryDate) {
            return res.status(400).send('All fields are required.');
        }

        if (discountValue > 100 || discountValue < 0) {
            return res.status(400).send('Discount value must be between 0 and 100.');
        }

        const parsedExpiryDate = new Date(expiryDate);
        if (isNaN(parsedExpiryDate) || parsedExpiryDate <= new Date()) {
            return res.status(400).send('Expiry date must be a valid future date.');
        }

        if (applicableTo === 'Product' && (!products || products.length === 0)) {
            return res.status(400).send('At least one product must be selected.');
        }

        if (applicableTo === 'Category' && (!categories || categories.length === 0)) {
            return res.status(400).send('At least one category must be selected.');
        }

        const existingOffer = await offerModel.findById(offerId);
        if (!existingOffer) {
            return res.status(404).send('Offer not found.');
        }

        if (existingOffer.applicableTo === 'Product') {
            await productModel.updateMany(
                { _id: { $in: existingOffer.products } },
                { $unset: { offer: "" } }
            );
        } else if (existingOffer.applicableTo === 'Category') {
            const oldCategoryProducts = await productModel.find({ categories: { $in: existingOffer.categories } });
            const oldCategoryProductIds = oldCategoryProducts.map(product => product._id);
            await productModel.updateMany(
                { _id: { $in: oldCategoryProductIds } },
                { $unset: { offer: "" } }
            );
        }

        const updateFields = {
            offerName,
            applicableTo,
            discountType,
            discountValue,
            expiryDate,
            products: [],
            categories: [],
        };

        if (applicableTo === 'Product') {
            updateFields.products = products ? (Array.isArray(products) ? products : [products]) : [];
        } else if (applicableTo === 'Category') {
            updateFields.categories = categories ? (Array.isArray(categories) ? categories : [categories]) : [];
        }

        const updatedOffer = await offerModel.findByIdAndUpdate(offerId, updateFields, { new: true });

        if (applicableTo === 'Product') {
            await productModel.updateMany(
                { _id: { $in: updateFields.products } },
                { $set: { offer: updatedOffer._id } }
            );
        } else if (applicableTo === 'Category') {
            const newCategoryProducts = await productModel.find({ categories: { $in: updateFields.categories } });
            const newCategoryProductIds = newCategoryProducts.map(product => product._id);
            await productModel.updateMany(
                { _id: { $in: newCategoryProductIds } },
                { $set: { offer: updatedOffer._id } }
            );

            updatedOffer.products = newCategoryProductIds;
            await updatedOffer.save();
        }

        res.redirect("/admin/offer");
    } catch (error) {
        console.error('Error updating offer:', error);
        res.status(500).json({ message: 'Failed to update offer.', error });
    }
};

const deleteOffer = async (req, res) => {
    const offerId = req.params.id
    try {
        await offerModel.findByIdAndDelete(offerId)
        res.redirect("/admin/offer")
    } catch (error) {
        res.send(error)
    }
}


module.exports = {
    loadCoupon,
    addCoupon,
    deleteCoupon,
    editCoupon,
    loadOffer,
    addOffer,
    editOffer,
    deleteOffer
}