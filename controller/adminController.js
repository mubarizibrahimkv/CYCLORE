const adminModel = require("../Model/adminModel");
const userModel = require("../Model/userModel");
const productModel = require("../Model/productModel")
const categoryModel = require("../Model/categoryModel");
const mongoose = require("mongoose")
const bcrypt = require("bcrypt");
const upload=require("../controller/imageController")

//---------login--------//
const loadLogin = async (req, res) => {
    res.render("admin/login");
}


const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            console.log("Email and password are required");
            return res.render("admin/login", { message: "Email and password are required" });
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            console.log("Invalid email format");
            return res.render("admin/login", { message: "Invalid email format" });
        }

        const admin = await adminModel.findOne({ email })
        if (!admin) return res.render("admin/login", { message: "Invalid credential" })

        const isMatch = await bcrypt.compare(password, admin.password);
        if (!isMatch) return res.render("admin/login", { message: "Incorrect Password" })
        req.session.admin = { id: admin._id, email: admin.email };
        res.redirect("/admin/dashboard");
        console.log("Admin logged in successfully");
    }
    catch (error) {
        console.error("Login error:", error);
        res.render("admin/login", { message: "Something went wrong. Please try again." });
    }
};

//----------dashboard---------//
const loadDashboard = async (req, res) => {
    try {
        const admin = req.session.admin
        if (!admin) return res.redirect("/admin/login");
        res.render("admin/dashboard")
    } catch (error) {
        res.send(error)
    }
}

//----------user management----------//
const loadUserManagement = async (req, res) => {
    try {
        const users = await userModel.find({});  // Fetch all users from the database
        res.render("admin/users", { users });
    } catch (error) {
        console.error(error);
        res.send("Error fetching user data");
    }
};


const blockUser = async (req, res) => {
    const userId = req.params.id;
    try {
        await userModel.findByIdAndUpdate(userId, { status: false });
        res.redirect("/admin/users");
    } catch (error) {
        res.send(error);
    }
}


const unblockUser = async (req, res) => {
    const userId = req.params.id;
    try {
        await userModel.findByIdAndUpdate(userId, { status: true });
        res.redirect("/admin/users");
    } catch (error) {
        res.send(error);
    }
};

//----------Category management--------//
const loadCategories = async (req, res) => {
    const categories = await categoryModel.find({})
    res.render("admin/categories", { categories })
};


const addCategory = async (req, res) => {
    try {
        const { name, variant } = req.body;

        if (!name || name.trim() === "") {
            return res.status(400).send('Category name is required');
        }

        const existingCategory = await categoryModel.findOne({ name });
        if (existingCategory) {
            return res.status(400).send('Category already exists');
        }

        const newCategory = new categoryModel({ name, variant, isListed: true }); // Default to listed
        await newCategory.save();
        res.redirect('/admin/categories');
    } catch (error) {
        console.error('Error adding category:', error);
        res.status(500).send('Internal Server Error');
    }
};

const editCategory = async (req, res) => {
    try {
        const { id, name, variant } = req.body;

        if (!name || name.trim() === "") {
            return res.status(400).send('Category name is required');
        }

        await categoryModel.findByIdAndUpdate(id, { name, variant });
        res.redirect('/admin/categories');
    } catch (error) {
        console.error('Error editing category:', error);
        res.status(500).send('Internal Server Error');
    }
};


const toggleCategoryStatus = async (req, res) => {
    const categoryId = req.params.id;
    try {
        const category = await categoryModel.findById(categoryId);
        const newStatus = !category.isListed; // Toggle the status
        await categoryModel.findByIdAndUpdate(categoryId, { isListed: newStatus });
        res.redirect("/admin/categories"); // Redirect after updating
    } catch (error) {
        console.error('Error toggling category status:', error);
        res.status(500).send('Internal Server Error');
    }
};

//------------Product management-----------//
const loadProducts = async (req, res) => {
    const products = await productModel.find({})
    res.render("admin/products", { products })
};


const path = require('path');

const addProduct = async (req, res) => {
    try {
        const { name, description, stock, category, price } = req.body;

        if (!name || name.trim() === "") {
            return res.status(400).send('Product name is required.');
        }

        const numericStock = parseInt(stock, 10);
        if (isNaN(numericStock) || numericStock < 0) {
            return res.status(400).send('Stock must be a non-negative integer.');
        }

        const numericPrice = parseFloat(price);
        if (isNaN(numericPrice) || numericPrice <= 0) {
            return res.status(400).send('Price must be a number greater than 0.');
        }

        if (!category || category.trim() === "") {
            return res.status(400).send('Category is required.');
        }

        const images = req.files && Array.isArray(req.files)
            ? req.files.map(file => path.join('uploads', path.basename(file.path)))
            : [];

        const newProduct = new productModel({
            name,
            description,
            stock,
            category,
            price,
            images,
            isListed: true
        });

        await newProduct.save();
        res.redirect("/admin/products");
    } catch (error) {
        console.log('Error adding product:', error);
        res.status(400).send('Error adding product: ' + error.message);
    }
};




const editProduct = async (req, res) => {
    const { id, name, category, price, stock, description } = req.body;
    const images = req.files; // Get the uploaded images from the request

    // Convert stock and price to proper formats
    const numericStock = parseInt(stock, 10);
    if (isNaN(numericStock) || numericStock < 0) {
        return res.status(400).send('Stock must be a non-negative integer.');
    }

    const numericPrice = parseFloat(price);
    if (isNaN(numericPrice) || numericPrice <= 0) {
        return res.status(400).send('Price must be a number greater than 0.');
    }

    if (!category || category.trim() === "") {
        return res.status(400).send('Category is required.');
    }

    let updateData = { name, category, price, stock, description };

    try {
        // Fetch the existing product from the database
        const product = await productModel.findById(id);

        if (!product) {
            return res.status(404).send('Product not found');
        }

        // If new images are uploaded, update the images field
        if (images && images.length > 0) {
            // Create a list of new image URLs
            const newImages = images.map(file => `uploads/${file.filename}`);

            // Assign the new images to the updateData object
            updateData.images = newImages;
        } else {
            // If no new images are uploaded, keep the existing images
            updateData.images = product.images; // Retain the existing images
        }

        // Update the product in the database
        await productModel.findByIdAndUpdate(id, updateData, { new: true });

        // Redirect to the product listing page
        res.redirect('/admin/products');
    } catch (error) {
        console.log('Error updating product:', error);
        res.status(500).send('Error updating product');
    }
};



const toggleProductStatus = async (req, res) => {
    const productId = req.params.id;
    try {
        const product = await productModel.findById(productId);
        if (!product) {
            console.log("Product not found");
            return res.status(404).send("Product not found");
        }
        const newStatus = !product.isListed;
        await productModel.findByIdAndUpdate(productId, { isListed: newStatus });
        res.redirect("/admin/products");
    } catch (error) {
        console.error("Error toggling product status:", error);
        res.status(500).send("Internal Server Error");
    }
};


const loadProfile = async (req, res) => {
    try {
        res.render("admin/profile")
    } catch (error) {
        res.send(error)
    }
}


const logout = async (req, res) => {
    delete req.session.admin

    res.redirect('/admin/login');
}

module.exports = {
    loadLogin,
    login,
    loadDashboard,
    loadUserManagement,
    unblockUser,
    blockUser,
    loadCategories,
    addCategory,
    editCategory,
    toggleCategoryStatus,
    loadProducts,
    addProduct,
    toggleProductStatus,
    editProduct,
    loadProfile,
    logout
}