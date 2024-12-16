const adminModel = require("../Model/adminModel");
const userModel = require("../Model/userModel");
const productModel = require("../Model/productModel")
const categoryModel = require("../Model/categoryModel");
const mongoose = require("mongoose")
const bcrypt = require("bcrypt");
const upload=require("../controller/imageController")
const path = require('path');


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

const loadUserManagement = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1; 
        const limit = 10; 
        const skip = (page - 1) * limit;

        const [users, totalUsers] = await Promise.all([
            userModel.find({}).skip(skip).limit(limit),
            userModel.countDocuments({})
        ]);

        const totalPages = Math.ceil(totalUsers / limit);

        res.render("admin/users", { 
            users, 
            currentPage: page, 
            totalPages 
        });
    } catch (error) {
        console.error(error);
        res.status(500).send("Error fetching user data");
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

const loadCategories = async (req, res) => {
    const categories = await categoryModel.find({})
    res.render("admin/categories", { categories })
};

const addCategory = async (req, res) => {
    try {
        const { name, variant } = req.body;

        // 1. Validate Empty Fields
        if (!name || name.trim() === "") {
            return res.status(400).send('Category name is required');
        }

        // 2. Check for Duplicate Category
        const existingCategory = await categoryModel.findOne({ name: name.trim() });
        if (existingCategory) {
            return res.status(400).send('Category already exists');
        }

        // 3. Save New Category
        const newCategory = new categoryModel({ name: name.trim(), variant, isListed: true });
        await newCategory.save();

        // Redirect or respond based on request type
        if (req.headers['content-type'] === 'application/json') {
            return res.status(201).json({ message: 'Category added successfully' });
        }
        res.redirect('/admin/categories');
    } catch (error) {
        console.error('Error adding category:', error);
        res.status(500).send('Internal Server Error');
    }
};

const checkDuplicateAddCategory = async (req, res) => {
    try {
        const { name, variant } = req.query;

        if (name) {
            const existingCategory = await categoryModel.findOne({
                name: { $regex: `^${name.trim()}$`, $options: "i" } 
            });
            return res.json({ isDuplicate: !!existingCategory });
        }

        if (variant) {
            const existingVariant = await categoryModel.findOne({
                variant: { $regex: `^${variant.trim()}$`, $options: "i" } 
            });
            return res.json({ isDuplicate: !!existingVariant });
        }

        res.json({ isDuplicate: false });
    } catch (error) {
        console.error('Error checking duplicate category:', error);
        res.status(500).json({ isDuplicate: false, error: 'Internal Server Error' });
    }
};

const checkDuplicateEditCategory = async (req, res) => {
    try {
        const { id, name } = req.body;

        const duplicate = await categoryModel.findOne({
            name: { $regex: `^${name.trim()}$`, $options: "i" }, 
            _id: { $ne: id }  
        });

        if (duplicate) {
            return res.json({ success: false });  
        }

        res.json({ success: true }); 
    } catch (error) {
        console.error("Error checking duplicate category name:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
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
        const newStatus = !category.isListed;
        await categoryModel.findByIdAndUpdate(categoryId, { isListed: newStatus });
        res.redirect("/admin/categories"); 
    } catch (error) {
        console.error('Error toggling category status:', error);
        res.status(500).send('Internal Server Error');
    }
};

const loadProducts = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1; 
        const limit = 7;
        const skip = (page - 1) * limit;

        const [products, totalProducts] = await Promise.all([
            productModel.find({}).populate("categories").skip(skip).limit(limit).lean(),
            productModel.countDocuments()
        ]);

        const totalPages = Math.ceil(totalProducts / limit);
        const categories = await categoryModel.find().lean();

        res.render("admin/products", { 
            products, 
            categories, 
            currentPage: page, 
            totalPages 
        });
    } catch (error) {
        console.error(error);
        res.status(500).send("Error fetching products");
    }
};

const addProduct = async (req, res) => {
    try {
        const { name, description, stock, category, price } = req.body;

        const validationErrors = [];

        if (!name || name.trim() === "") {
            validationErrors.push("Product name is required.");
        } else if (name.length < 3) {
            validationErrors.push("Product name must be at least 3 characters long.");
        }

        if (!description || description.trim() === "") {
            validationErrors.push("Product description is required.");
        }

        if (!stock || isNaN(stock) || stock < 0) {
            validationErrors.push("Stock must be a non-negative number.");
        }

        if (!category || category.trim() === "") {
            validationErrors.push("Category is required.");
        }

        if (!price || isNaN(price) || price <= 0) {
            validationErrors.push("Price must be a positive number.");
        }

        const images = req.files && Array.isArray(req.files)
            ? req.files.map(file => path.join('uploads', path.basename(file.path)))
            : [];
            
        if (images.length === 0) {
            validationErrors.push("At least one product image is required.");
        }

        if (validationErrors.length > 0) {
            return res.status(400).json({ errors: validationErrors });
        }

        const newProduct = new productModel({
            name,
            description,
            stock,
            categories: category,
            price,
            images,
            isListed: true,
        });

        await newProduct.save();
        res.redirect("/admin/products");
    } catch (error) {
        console.log("Error adding product:", error);
        res.status(500).send("Error adding product: " + error.message);
    }
};

const editProduct = async (req, res) => {
    const { id, name, category, price, stock, description } = req.body;

    const images = req.files;

    let updateData = {};

    try {
        if (!id) {
            return res.status(400).send("Product ID is required.");
        }

        const product = await productModel.findById(id);

        if (!product) {
            return res.status(404).send("Product not found.");
        }

        const validationErrors = [];

        if (name) {
            if (name.trim() === "") {
                validationErrors.push("Product name cannot be empty.");
            } else if (name.length < 3) {
                validationErrors.push("Product name must be at least 3 characters long.");
            }
            updateData.name = name;
        }

        if (category) {
            const categoryDoc = await categoryModel.findOne({ name: category.trim() });
            if (!categoryDoc) {
                validationErrors.push("Invalid category.");
            } else {
                updateData.categories = categoryDoc._id; 
            }
        }
        

        if (price) {
            if (isNaN(price) || price <= 0) {
                validationErrors.push("Price must be a positive number.");
            }
            updateData.price = price;
        }

        if (stock) {
            if (isNaN(stock) || stock < 0) {
                validationErrors.push("Stock must be a non-negative number.");
            }
            updateData.stock = stock;
        }

        if (description) {
            if (description.trim() === "") {
                validationErrors.push("Description cannot be empty.");
            }
            updateData.description = description;
        }

        if (images && images.length > 0) {
            const newImages = images.map(file => `uploads/${file.filename}`);
            updateData.images = newImages;
        } else {
            updateData.images = product.images; 
        }

        if (validationErrors.length > 0) {
            return res.status(400).json({ errors: validationErrors });
        }

        await productModel.findByIdAndUpdate(id, updateData, { new: true });

        res.redirect('/admin/products');
    } catch (error) {
        console.log("Error updating product:", error);
        res.status(500).send("Error updating product: " + error.message);
    }
};

const duplicateProductName=async(req,res)=>{
    console.log("sdfgjsauidhfguiad");
    
    const { name } = req.query;
    try {
        const product = await productModel.findOne({ name: name.trim() });
        if (product) {
            return res.status(200).json({ exists: true });
        }
        return res.status(200).json({ exists: false });
    } catch (err) {
        return res.status(500).json({ error: "Server error" });
    }
}

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
    loadUserManagement,
    unblockUser,
    blockUser,
    loadCategories,
    addCategory,
    checkDuplicateAddCategory,
    checkDuplicateEditCategory,
    editCategory,
    toggleCategoryStatus,
    loadProducts,
    addProduct,
    toggleProductStatus,
    editProduct,
    loadProfile,
    logout,
    duplicateProductName
}