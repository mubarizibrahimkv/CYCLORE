const orderModel=require("../Model/orderModel")
const productModel=require("../Model/productModel")


const loadDashboard = async (req, res) => {
    try {
        const [bestProducts, bestCategories] = await Promise.all([
            orderModel.aggregate(bestSellingProductsPipeline),
            orderModel.aggregate(bestSellingCategoriesPipeline),
        ]);
        res.render("admin/dashboard",{bestProducts,bestCategories})
    } catch (error) {
        res.send(error)
    }
}

const getSalesData = async (req, res) => {
    const filter = req.query.filter || 'yearly'; 
    const currentYear = new Date().getFullYear();
    const pipeline = [];

    try {
        if (filter === 'yearly') {
            const startYear = currentYear - 2; 
            const years = [startYear, startYear + 1, startYear + 2];

            pipeline.push(
                {
                    $match: {
                        "products.status": { $nin: ['Cancelled', 'Returned'] }, 
                    },
                },
                {
                    $project: {
                        year: { $year: "$createdAt" },
                        totalPrice: {
                            $sum: {
                                $map: {
                                    input: "$products",
                                    as: "product",
                                    in: {
                                        $multiply: [
                                            "$$product.quantity",
                                            {
                                                $cond: {
                                                    if: { $gt: ["$$product.discountedPrice", 0] },
                                                    then: "$$product.discountedPrice",
                                                    else: "$$product.price",
                                                },
                                            },
                                        ],
                                    },
                                },
                            },
                        },
                    },
                },
                {
                    $group: {
                        _id: "$year", 
                        totalPrice: { $sum: "$totalPrice" },
                    },
                },
                { $sort: { _id: 1 } } 
            );
        } else if (filter === 'monthly') {
            pipeline.push(
                {
                    $match: {
                        createdAt: {
                            $gte: new Date(currentYear, 0, 1),
                            $lt: new Date(currentYear + 1, 0, 1),
                        },
                        "products.status": { $nin: ['Cancelled', 'Returned'] },
                    },
                },
                {
                    $project: {
                        month: { $month: "$createdAt" }, 
                        totalPrice: {
                            $sum: {
                                $map: {
                                    input: "$products",
                                    as: "product",
                                    in: {
                                        $multiply: [
                                            "$$product.quantity",
                                            {
                                                $cond: {
                                                    if: { $gt: ["$$product.discountedPrice", 0] },
                                                    then: "$$product.discountedPrice",
                                                    else: "$$product.price",
                                                },
                                            },
                                        ],
                                    },
                                },
                            },
                        },
                    },
                },
                {
                    $group: {
                        _id: "$month",
                        totalPrice: { $sum: "$totalPrice" },
                    },
                },
                { $sort: { _id: 1 } } 
            );
        } else if (filter === 'weekly') {
            pipeline.push(
                {
                    $match: {
                        "products.status": { $nin: ['Cancelled', 'Returned'] },
                    },
                },
                {
                    $project: {
                        week: { $isoWeek: "$createdAt" },
                        totalPrice: {
                            $sum: {
                                $map: {
                                    input: "$products",
                                    as: "product",
                                    in: {
                                        $multiply: [
                                            "$$product.quantity",
                                            {
                                                $cond: {
                                                    if: { $gt: ["$$product.discountedPrice", 0] },
                                                    then: "$$product.discountedPrice",
                                                    else: "$$product.price",
                                                },
                                            },
                                        ],
                                    },
                                },
                            },
                        },
                    },
                },
                {
                    $group: {
                        _id: "$week",
                        totalPrice: { $sum: "$totalPrice" },
                    },
                },
                { $sort: { _id: 1 } } 
            );
        } else {
            return res.status(400).send('Invalid filter type');
        }

        const orders = await orderModel.aggregate(pipeline);

        const labels = [];
        const totalPrices = [];

        if (filter === 'yearly') {
            const years = [currentYear - 2, currentYear - 1, currentYear];
            const salesData = years.map((year) => {
                const order = orders.find((order) => order._id === year);
                return order ? order.totalPrice : 0; 
            });

            labels.push(...years);
            totalPrices.push(...salesData);
        } else if (filter === 'monthly') {
            const months = [
                'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
            ];
            const monthlyData = new Array(12).fill(0);

            orders.forEach((order) => {
                monthlyData[order._id - 1] = order.totalPrice;
            });

            labels.push(...months);
            totalPrices.push(...monthlyData);
        } else if (filter === 'weekly') {
            orders.forEach((order) => {
                labels.push(`Week ${order._id}`);
                totalPrices.push(order.totalPrice);
            });
        }

        res.json({ labels, totalPrices });
    } catch (error) {
        console.error('Error fetching sales data:', error);
        res.status(500).send('Error fetching sales data.');
    }
};

const bestSellingProductsPipeline = [
    { $unwind: "$products" }, // Deconstruct the products array
    {
        $match: {
            "products.status": { $nin: ["Cancelled", "Returned"] }, // Exclude cancelled and returned
        },
    },
    {
        $group: {
            _id: "$products.productId", // Group by productId
            totalSold: { $sum: "$products.quantity" }, // Calculate total quantity sold
        },
    },
    { $sort: { totalSold: -1 } }, // Sort by totalSold in descending order
    { $limit: 10 }, // Limit to the top 10 best-selling products
    {
        $lookup: {
            from: "products", // Lookup product details
            localField: "_id",
            foreignField: "_id",
            as: "productDetails",
        },
    },
    { $unwind: "$productDetails" }, // Unwind the productDetails array
    {
        $project: {
            _id: 1,
            totalSold: 1,
            name: "$productDetails.name", // Include product name
            price: "$productDetails.price", // Include product price
        },
    },
];

const bestSellingCategoriesPipeline = [
    { $unwind: "$products" },
    {
        $match: {
            "products.status": { $nin: ["Cancelled", "Returned"] },
        },
    },
    {
        $lookup: {
            from: "products", 
            localField: "products.productId",
            foreignField: "_id",
            as: "productDetails",
        },
    },
    { $unwind: "$productDetails" }, 
    {
        $lookup: {
            from: "categories", 
            localField: "productDetails.categories",
            foreignField: "_id",
            as: "categoryDetails",
        },
    },
    { $unwind: "$categoryDetails" }, 
    {
        $group: {
            _id: "$categoryDetails.name",
            totalSold: { $sum: "$products.quantity" },
        },
    },
    { $sort: { totalSold: -1 } },
    { $limit: 10 },
    {
        $project: {
            _id: 1,
            totalSold: 1,
        },
    },
];

module.exports={
    loadDashboard,
    getSalesData
}