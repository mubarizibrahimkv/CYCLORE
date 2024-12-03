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
    const id = req.params.id
    const { code, discountType, discountValue, minPurchase, maxDiscount, expiryDate } = req.body;
    try {
        await couponModel.findByIdAndUpdate(id, {
            code, discountType, discountValue, minPurchase, maxDiscount, expiryDate
        })
        res.redirect("/admin/coupon")
    } catch (error) {
        console.error(error);
        res.status(500).send('Error deactivating coupon')
    }
}

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
        if (!offerName || offerName.trim() === '') {
            return res.status(400).send('Offer name is required.');
        }
        if (!['Product', 'Category'].includes(applicableTo)) {
            return res.status(400).send('ApplicableTo must be either "Product" or "Category".');
        }
        if (applicableTo === 'Product' && (!products || products.length === 0)) {
            return res.status(400).send('At least one product must be selected for a product-specific offer.');
        }
        if (applicableTo === 'Category' && (!categories || categories.length === 0)) {
            return res.status(400).send('At least one category must be selected for a category-specific offer.');
        }
        if (!['percentage', 'fixed'].includes(discountType)) {
            return res.status(400).send('Discount type must be either "percentage" or "fixed".');
        }
        if (!discountValue || discountValue <= 0) {
            return res.status(400).send('Discount value must be a positive number.');
        }
        if (!expiryDate || isNaN(new Date(expiryDate).getTime())) {
            return res.status(400).send('A valid expiry date is required.');
        }
        if (new Date(expiryDate) <= new Date()) {
            return res.status(400).send('Expiry date must be in the future.');
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

        console.log('New offer created:', newOffer);

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
                console.log(`No products found for categories: ${categories}`);
                return res.status(404).send('No products associated with the selected categories.');
            }
        
            console.log('Products found:', productsInCategories);
        
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
}

const editOffer = async (req, res) => {
    const offerId = req.params.id;
    const {
        offerName,
        applicableTo,
        products,
        categories,
        discountType,
        discountValue,
        expiryDate
    } = req.body;

    try {
        const existingOffer = await offerModel.findById(offerId);

        if (!existingOffer) {
            return res.status(404).json({ message: 'Offer not found' });
        }

        if (!offerName || offerName.trim() === '') {
            return res.status(400).send('Offer name is required.');
        }

        if (!['Product', 'Category'].includes(applicableTo)) {
            return res.status(400).send('ApplicableTo must be either "Product" or "Category".');
        }

        if (applicableTo === 'Product' && (!products || products.length === 0)) {
            return res.status(400).send('At least one product must be selected for a product-specific offer.');
        }

        if (applicableTo === 'Category' && (!categories || categories.length === 0)) {
            return res.status(400).send('At least one category must be selected for a category-specific offer.');
        }

        if (!['percentage', 'fixed'].includes(discountType)) {
            return res.status(400).send('Discount type must be either "percentage" or "fixed".');
        }

        if (!discountValue || discountValue <= 0) {
            return res.status(400).send('Discount value must be a positive number.');
        }

        if (!expiryDate || isNaN(new Date(expiryDate).getTime())) {
            return res.status(400).send('A valid expiry date is required.');
        }

        const currentDate = new Date();
        if (new Date(expiryDate) <= currentDate) {
            return res.status(400).send('Expiry date must be in the future.');
        }

        const updateFields = {
            offerName,
            applicableTo,
            discountType,
            discountValue,
            expiryDate,
            products: [],
            categories: []
        };

        if (applicableTo === 'Product') {
            updateFields.products = products ? (Array.isArray(products) ? products : [products]) : [];
        } else if (applicableTo === 'Category') {
            updateFields.categories = categories ? (Array.isArray(categories) ? categories : [categories]) : [];
        }

        if (existingOffer.applicableTo === 'Product') {
            await productModel.updateMany(
                { _id: { $in: existingOffer.products } },
                { $unset: { offer: "" } }
            );
        } else if (existingOffer.applicableTo === 'Category') {
            const oldCategoryProducts = await productModel.find({
                category: { $in: existingOffer.categories }
            });

            const oldCategoryProductIds = oldCategoryProducts.map((product) => product._id);
            await productModel.updateMany(
                { _id: { $in: oldCategoryProductIds } },
                { $unset: { offer: "" } }
            );
        }

        const updatedOffer = await offerModel.findByIdAndUpdate(offerId, updateFields, { new: true });

        if (applicableTo === 'Product') {
            await productModel.updateMany(
                { _id: { $in: updateFields.products } },
                { $set: { offer: updatedOffer._id } }
            );
        } else if (applicableTo === 'Category') {
            const newCategoryProducts = await productModel.find({
                category: { $in: updateFields.categories }
            });

            const newCategoryProductIds = newCategoryProducts.map((product) => product._id);
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