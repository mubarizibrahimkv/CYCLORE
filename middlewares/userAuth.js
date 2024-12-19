const userModel = require('../Model/userModel');

const checkSession = async (req, res, next) => {
    try {
        if (req.session.user) {
            const user = await userModel.findById(req.session.user);

            if (!user || user.status === false) {
                delete req.session.user;
                return res.render("user/login", { message: "User is blocked by admin" })
            }
            next();
        } else {
            res.redirect('/');
        }
    } catch (error) {
        res.status(500).send('Internal Server Error');
    }
};


const isLogin = (req, res, next) => {
    if (req.session.user) {
        res.redirect('/');
    } else {
        next();
    }
};

module.exports = { checkSession, isLogin };
