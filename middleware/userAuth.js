const User = require("../models/userModel");
const Products = require("../models/productModel");

const isLogin = async (req, res, next) => {
    try {
        if (req.session.user) {
            console.log("session user is --> ", req.session.user);
            res.locals.customer = true;
            return next();
        } else {
            console.log("=============user not found=============");
            
            res.locals.customer = false;
            const ProductData = await Products.find().populate('offerId');
            return res.render("user/index", { ProductData });
        }
    } catch (error) {
        console.log(error.message);
        res.redirect('/auth/login');
    }
};

const  isLogout = async (req, res, next) => {
    console.log("Logout id calling");
    
    try {
        if (!req.session.user) {
            return next();
        } else {
            console.log("logout user has inside ==>");
            
            return res.redirect('/userhome');
        }
    } catch (error) {
        console.log(error.message);
        res.redirect('/');
    }
};

const isUserBlock = async (req, res, next) => {
    try {
        const checkUser = await User.findById(req.session.user);
        if (checkUser && checkUser.is_blocked) {
            req.session.user = null;
            return res.redirect('/auth/login');
        } else {
            return next();
        }
    } catch (error) {
        console.log(error.message);
        res.redirect('/auth/login');
    }
};

module.exports = {
    isLogin,
    isLogout,
    isUserBlock,
};
