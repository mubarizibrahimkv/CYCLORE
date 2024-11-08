const userModel = require("../Model/userModel")
const bcrypt = require("bcrypt")
const nodeMailer = require("nodemailer")
const productModel = require("../Model/productModel")
// const env = require("dotenv").config()

const pageNotFound = async (req, res) => {
    try {
        res.render("user/page-404")
    } catch (error) {
        res.redirect("/pageNotFound")
    }
}

const loadHomePage = async (req, res) => {
    try {
        return res.render("user/home")
    } catch (error) {
        res.send(error)
    }
}

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
                user: "mubarismubuk.v@gmail.com",
                pass: "ptzk bwys odcm wdcu"
            }
        });

        const info = await transporter.sendMail({
            from: "mubarismubuk.v@gmail.com",
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
        throw error; // Rethrow the error to be caught in the caller
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
        req.session.user = { id: user._id, email: user.email };
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
        const products = await productModel.find({ isListed: true })
        res.render("user/shop", { products })
    } catch (error) {
        console.error("Error fetching products:", error);
        res.status(500).send("Internal Server Error");
    }
}

//--------------single product-------------
const loadSingleProduct = async (req, res) => {
    try {
        const productId = req.params.id;
        const product = await productModel.findById(productId)
        res.render("user/singleProduct", { product })
    } catch (error) {
        res.send(error)
    }
}

//-----------profile------------
const loadProfile = async (req, res) => {
    try {
        res.render("user/profile")
    } catch (error) {
        res.send(error)
    }
}

//---------logout-----------------
const userLogout = async (req, res) => {
    delete req.session.user
    res.redirect('/login');
};


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
    loadProfile,
    userLogout
}