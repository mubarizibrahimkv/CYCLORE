const userModel = require("../Model/userModel")
const bcrypt = require("bcrypt")
const nodeMailer = require("nodemailer")
const productModel = require("../Model/productModel")
const offerModel = require("../Model/offerModel")
require("dotenv").config()
const session = require("express-session")



const pageNotFound = async (req, res) => {
    try {
        res.render("user/page-404")
    } catch (error) {
        res.redirect("/pageNotFound")
    }
}

const loadHomePage = async (req, res) => {
    try {
        const bannerImages = [
            '/img/banner/banner-image.png',
            '/img/banner/ebikes.webp',
            '/img/banner/flanker.webp',
            '/img/banner/lectro10.png'
        ];

        const randomImage = bannerImages[Math.floor(Math.random() * bannerImages.length)];
        return res.render("user/home", { bannerImagePath: randomImage })
    } catch (error) {
        res.send(error)
    }
}

const checkBlockStatus = async (req, res) => {
    try {
        const userId = req.session.user?.id;

        if (!userId) {
            console.log("User not logged in. Redirecting to login page.");
            return res.status(401).json({ error: 'User not logged in.' });
        }

        const user = await userModel.findById(userId);

        if (!user) {
            console.log("User not found. Redirecting to login page.");
            return res.status(404).json({ error: 'User not found.' });
        }

        if (user.status === false) {
            delete req.session.user;
            console.log("Session deleted due to block status.");
            return res.json({ success: false, notBlocked: false });
        }

        res.json({ success: true, notBlocked: true });

    } catch (error) {
        console.error('Error checking block status:', error);
        res.status(500).json({ error: 'Error checking block status.' });
    }
};

// ---------------register------------------
const loadRegister = async (req, res) => {
    try {
        return res.render("user/register");
    } catch (error) {
        res.send(error);
    }
};

function generateOtp() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

async function sendVerificationEmail(email, otp) {
    try {
        const transporter = nodeMailer.createTransport({
            service: "gmail",
            port: 587,
            secure: false,
            requireTLS: true,
            auth: {
                user: process.env.NODEMAILER_EMAIL,
                pass: process.env.NODEMAILER_PASSWORD,
            }
        });

        const info = await transporter.sendMail({
            from: process.env.NODEMAILER_EMAIL,
            to: email,
            subject: "Verify your account",
            text: `Your OTP is ${otp}`,
            html: `<b>Your OTP: ${otp}</b>`
        });

        return info.accepted.length > 0;
    } catch (error) {
        console.error("Error sending email", error);
        return false;
    }
}

const registerUser = async (req, res) => {
    try {
        const { username, phone, email, password, "confirm-password": Cpassword } = req.body;

        if (!username || !phone || !email || !password || !Cpassword) {
            console.log("All fields are required");
            return res.render("user/register", { message: "All fields are required" });
        }

        if (password !== Cpassword) {
            console.log("Passwords do not match");
            return res.render("user/register", { message: "Passwords do not match" });
        }

        const findUser = await userModel.findOne({ email });
        if (findUser) {
            console.log("User with this email already exists");
            return res.render("user/register", { message: "User with this email already exists" });
        }

        const otp = generateOtp();
        const emailSent = await sendVerificationEmail(email, otp);
        if (!emailSent) {
            console.log("Email error");
            return res.json("email-error");
        }

        req.session.userOtp = otp;
        req.session.userData = { username, phone, email, password };
        res.render("user/verify-otp");
        console.log("Generated OTP:", otp);

    } catch (error) {
        console.error("Signup error", error);
        res.redirect("/pageNotFound");
    }
};

const googleAuth = async (req, res) => {
    try {
        const user = req.user;
        if (!user) {
            return res.redirect("/register");
        }
        if (user.status === "false") {
            return res.render("user/register", { message: "User is blocked by admin" });
        }
        req.session.user=user
        res.redirect("/");
    } catch (error) {
        console.error("Google authentication error:", error);
        res.redirect("/pageNotFound");
    }
};

const securePassword = async (password) => {
    try {
        const passwordHash = await bcrypt.hash(password, 10);
        return passwordHash;
    } catch (error) {
        console.error("Error hashing password:", error);
        throw error;
    }
};

const verifyOtp = async (req, res) => {
    try {
        const { otp } = req.body;
        if (otp.trim() === req.session.userOtp.toString().trim()) {
            const user = req.session.userData
            const passwordHash = await securePassword(user.password);
            const saveUserData = new userModel({
                email: user.email,
                phone: user.phone,
                password: passwordHash,
                username: user.username
            })

            await saveUserData.save()
            req.session.user = saveUserData._id
            res.json({ success: true, redirectUrl: "/" });
        } else {
            console.log("OTP mismatch or missing data.");
            res.status(400).json({ success: false, message: "Invalid OTP, Please try again" });
        }
    } catch (error) {
        console.error("Error during OTP verification:", error);
        res.status(500).json({ success: false, message: "An error occurred" });
    }
};

const resendOtp = async (req, res) => {
    try {
        const { email } = req.session.userData;
        if (!email) {
            return res.status(400).json({ success: false, message: "Email not found in session" })
        }
        const otp = generateOtp();
        req.session.userOtp = otp;

        const emailSent = await sendVerificationEmail(email, otp);
        if (emailSent) {
            console.log("Resend OTP:" + otp)
            res.status(200).json({ success: true, message: "OTP Resend Successfully" })
        } else {
            res.status(500).json({ success: false, message: "Failed to resend OTP.Please tr again" });
        }

    } catch (error) {
        console.error("Error resending OTP:", error);
        res.status(500).json({ success: false, message: "Internal Server Error:Please try again" });
    }
};

// ----------Login-----------------
const loadLogin = (req, res) => {
    try {
        if (!req.session.user) {
            return res.render("user/login");
        } else {
            res.redirect("/")
        }
    } catch (error) {
        res.redirect('/pageNotFound');
    }
}

const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            console.log("Email and password are required");
            return res.render("user/login", { message: "Email and password are required" });
        }

        const user = await userModel.findOne({ email: email });
        if (!user) return res.render("user/login", { message: "User does not exist" });

        if (user.status === false) {
            return res.render("user/login", { message: "User is blocked by admin" })
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.render("user/login", { message: "Incorrect password" });
        req.session.user = user._id

        res.render("user/home", { message: "Login successful" });
        console.log("User logged in successfully");

    } catch (error) {
        res.render("user/login", { message: "Something wrong" })
        console.log(error);
    }
};

//------------Shop-----------
const loadShop = async (req, res) => {
    try {
        const { category, sort, minPrice, maxPrice } = req.query;

        let filterQuery = { isListed: true };

        if (category) {
            filterQuery.category = category;
        }

        if (minPrice || maxPrice) {
            filterQuery.price = {};
            if (minPrice) filterQuery.price.$gte = minPrice;
            if (maxPrice) filterQuery.price.$lte = maxPrice;
        }

        let sortQuery = {};
        if (sort === 'az') {
            sortQuery.name = 1;
        } else if (sort === 'za') {
            sortQuery.name = -1;
        } else if (sort === 'new-arrivals') {
            sortQuery.createdAt = -1;
        }

        const products = await productModel.find(filterQuery).populate("offer").sort(sortQuery);                
        products.forEach((product) => {
            product.discountedPrice = product.price;

            if (product.offer) {
                const isOfferForCategory = product.offer.applicableTo === 'Category' &&
                    product.offer.categories && product.offer.categories.includes(product.category);

                if (product.offer.discountType === 'percentage' && isOfferForCategory) {
                    const discount = (product.price * product.offer.discountValue) / 100;
                    product.discountedPrice = product.price - discount;
                    console.log(`Applying Percentage Discount: ${discount}`);
                }
                else if (product.offer.discountType === 'fixed' && isOfferForCategory) {
                    product.discountedPrice = product.price - product.offer.discountValue;
                    console.log(`Applying Fixed Discount: ${product.offer.discountValue}`);
                }
                else if (product.offer.applicableTo === 'Product') {
                    if (product.offer.discountType === 'percentage') {
                        const discount = (product.price * product.offer.discountValue) / 100;
                        product.discountedPrice = product.price - discount;
                    } else if (product.offer.discountType === 'fixed') {
                        product.discountedPrice = product.price - product.offer.discountValue;
                    }
                }
            }
        });

        res.render('user/shop', { products });

    } catch (error) {
        console.error('Error fetching products:', error);
        res.status(500).send('Internal Server Error');
    }
};

//--------------single product-------------
const loadSingleProduct = async (req, res) => {
    try {
        const productId = req.params.id;

        // Fetch product and populate its offer and category
        const product = await productModel
            .findById(productId)
            .populate('offer')
            .populate('category'); // Ensure category is included

        if (!product) {
            return res.status(404).send('Product not found');
        }

        let discountedPrice = product.price;

        if (product.offer) {
            // Check if the offer is category-specific
            const isOfferForCategory =
                product.offer.applicableTo === 'Category' &&
                product.offer.categories &&
                product.offer.categories.includes(product.category?._id.toString());

            // Check if the offer is product-specific or category-specific
            if (product.offer.discountType === 'percentage' && (product.offer.applicableTo === 'Product' || isOfferForCategory)) {
                const discount = (product.price * product.offer.discountValue) / 100;
                discountedPrice = product.price - discount;
            } else if (product.offer.discountType === 'fixed' && (product.offer.applicableTo === 'Product' || isOfferForCategory)) {
                discountedPrice = product.price - product.offer.discountValue;
            }
        }

        // Render with computed discounted price
        res.render('user/singleProduct', {
            product: {
                ...product.toObject(),
                discountedPrice, // Add the computed discounted price
            },
        });
    } catch (error) {
        console.error('Error loading single product:', error);
        res.status(500).send('Internal Server Error');
    }
};

const forgotPasswordPage = async (req, res) => {
    try {
        res.render("user/forgotPassword")
    } catch (error) {
        res.redirect("/pagepageNotFound")
    }
}

const forgotEmailValid = async (req, res) => {
    try {
        const { email } = req.body

        const findUser = await userModel.findOne({ email: email })
        if (findUser) {
            const otp = generateOtp()
            const emailSent = sendVerificationEmail(email, otp);
            if (emailSent) {
                req.session.userOtp = otp
                req.session.email = email
                res.render("user/forgotPass-otp")
                console.log("otp:", otp);
            } else {
                res.json({ success: false, message: "Failed to send OTP.Please try again" })
            }
        } else {
            res.render("user/forgotPassword", { message: "User with this email does not exist" })
        }
    } catch (error) {
        res.redirect("/pageNotFound")
    }
}

const verifyForgotPassOtp = async (req, res) => {
    try {
        const enteredOtp = String(req.body.otp).trim();
        const sessionOtp = String(req.session.userOtp).trim();
        if (enteredOtp === sessionOtp) {
            res.json({ success: true, redirectUrl: "/reset-password" })
        } else {
            res.json({ success: false, message: "OTP not matching" })
        }
    } catch (error) {
        res.status(500).json({ success: false, message: "An error occured.Please try again" })
    }
}

const loadResetPassword = async (req, res) => {
    try {
        res.render("user/resetPassword")
    } catch (error) {
        res.redirect("/pageNotFound")
    }
}

const forgotResendOtp=async(req,res)=>{
    try {
        const otp=generateOtp()
        req.session.userOtp=otp
        const email=req.session.email
        const emailSend=await sendVerificationEmail(email,otp)
        if(emailSend){
            console.log("Resending OTP :",otp);
            res.status(200).json({success:true,message:"Resend OTP successfull"})
        }
    } catch (error) {
        res.status(500).json({success:false,message:"Internal server error"})
    }
}

const postNewPassword=async(req,res)=>{
    try {
        const {password,confirmPassword}=req.body
        const email=req.session.email
        if(password===confirmPassword){
            const passwordHash=await securePassword(password)
            await userModel.updateOne(
                {email:email},
                {$set:{password:passwordHash}}
            )
            console.log("updated");
            
            res.redirect("/login")
        }else{
            res.render("user/resetPassword",{message:"Password do not match"})
        }  
    } catch (error) {
        res.redirect("/pageNotFound")
    }
}


module.exports = {
    pageNotFound,
    loadHomePage,
    loadRegister,
    registerUser,
    googleAuth,
    login,
    loadLogin,
    verifyOtp,
    resendOtp,
    loadShop,
    loadSingleProduct,
    checkBlockStatus,
    forgotPasswordPage,
    forgotEmailValid,
    verifyForgotPassOtp,
    loadResetPassword,
    forgotResendOtp,
    postNewPassword
}