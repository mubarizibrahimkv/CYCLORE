const productModel = require("../Model/productModel")


const loadInventory = async (req, res) => {
    try {
        const inventory = await productModel.find()
        res.render("admin/inventory", { inventory });
    } catch (error) {
        console.error("Error loading inventory:", error);
        res.status(500).send("Error loading inventory.");
    }
};


const updateStock = async (req, res) => {
    const productId = req.params.id
    const newStock = req.body.stock

    if (!newStock) {
        return res.status(400).send("Stock value is required");
    }

    try {
        await productModel.findByIdAndUpdate(productId, { stock: newStock })
        res.redirect("/admin/inventory")
    } catch (error) {
        console.error("Error updating stock:", error);
        res.status(500).send("Error updating stock.");
    }
}


module.exports = {
    loadInventory,
    updateStock,
}