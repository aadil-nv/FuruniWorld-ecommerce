const User = require("../../models/userModel");
const Otp = require("../../models/otp");
const bcrypt = require("bcrypt");
const Address = require("../../models/addressModel");
const Cart = require("../../models/cartModel");
const order = require("../../models/orderModal");
const Coupon = require("../../models/couponModal");
const Category = require("../../models/categoryModel");
const Products = require("../../models/productModel")
require("dotenv").config();





let userData;


const home = async (req, res) => {
  try {
    const user=req.session.user
    const ProductData = await Products.find().populate("offerId");
    const cartData = await Cart.find({ userId: user });

    // Calculate total count of products in all carts
    let productcount = 0;
    for (const cart of cartData) {
      productcount += cart.products.length;
    }

    res.render("user/index", { ProductData, productcount});
  } catch (erorr) {
    console.log("Error from home",erorr.message);
  }
};


const loadUserProfile = async (req, res) => {
  try {
    const userData = await User.findOne({ _id: req.session.user })
    const addressData = await Address.find({ userId: req.session.user }).sort({_id:-1});
    const orderData = await order
      .find({ userId: req.session.user })
      .populate("orderedItem.productId").sort({_id:-1})
    const couponData = await Coupon.find().sort({_id:-1})
    const user=req.session.user
    const cartData = await Cart.find({ userId: user });

    // Calculate total count of products in all carts
    let productcount = 0;
    for (const cart of cartData) {
      productcount += cart.products.length;
    }
    let added = req.query.msg;

    if (User) {
      userData.walletHistory.sort((a, b) => new Date(b.date) - new Date(a.date));
      const message = req.flash("succ");
      if (added) {
        return res.render("user/userprofile", {
          userData,
          addressData,
          message,
          added,
          orderData,
          couponData,
          productcount
        });
      } else {
        return res.render("user/userprofile", {
          userData,
          addressData,
          message,
          orderData,
          couponData,
          productcount
        });
      }
    }
  } catch (error) {
    console.log("Error from loadUserProfile",error.message);
  }
};


const resendOtp = async (req, res) => {
  try {
    const newotp = generateOTP();

    verifyEmail(userData.name, userData.email, newotp);
    await Otp.updateOne({ email: userData.email }, { otp: newotp });

    res.render("user/otp");
  } catch (error) {
    console.log(error.message);
  }
};

const backToUserHome = async (req, res) => {
  try {
    const user=req.session.user
    const ProductData = await Products.find().populate('offerId')
    const cartData = await Cart.find({ userId: user });

    // Calculate total count of products in all carts
    let productcount = 0;
    for (const cart of cartData) {
      productcount += cart.products.length;
    }

    res.render("user/index", { ProductData, User: req.session.user ,productcount});
  } catch (error) {
    console.log(error.message);
  }
};



const loadShopPage= async(req, res)=> {
  try {
    const productsPerPage = 12;
    const user=req.session.user
    const cartData = await Cart.find({ userId: user });
    let currentPage = parseInt(req.query.page) || 1;

    const totalProducts = await Products.countDocuments();


    const totalPages = Math.ceil(totalProducts / productsPerPage);
    const categoryData = await Category.find()

    if (currentPage < 1) {
        currentPage = 1;
    } else if (currentPage > totalPages) {
        currentPage = totalPages;
    }

    const startIndex = (currentPage - 1) * productsPerPage;
    const endIndex = Math.min(startIndex + productsPerPage, totalProducts);

    let productcount = 0;
    for (const cart of cartData) {
      productcount += cart.products.length;
    }

    const productData = await Products.find().populate("offerId").skip(startIndex).limit(productsPerPage);

   
    res.render("user/shop", { User, productData, categoryData, currentPage, totalPages ,productcount});
} catch (error) {
    console.error(error);
    res.status(500).send("Internal Server Error");
}
}



const loadAboutPage = async (req, res) => {
  try {
    const user=req.session.user
    const cartData = await Cart.find({ userId: user });

    
    let productcount = 0;
    for (const cart of cartData) {
      productcount += cart.products.length;
    }
    res.render("user/about", { User ,productcount});
  } catch (error) {
    console.log(error.message);
  }
};


const loadContactPage = async (req, res) => {
  try {
    const user=req.session.user
    const cartData = await Cart.find({ userId: user });

    let productcount = 0;
    for (const cart of cartData) {
      productcount += cart.products.length;
    }
    res.render("user/contact", { User ,productcount});
  } catch (error) {
    console.log(error.message);
  }
};


const editUseprofile = async (req, res) => {
  try {
    const user=req.session.user
    const userData = await User.findOne({ _id: req.session.user });
    const cartData = await Cart.find({ userId: user });

    let productcount = 0;
    for (const cart of cartData) {
      productcount += cart.products.length;
    }
    res.render("user/edituserdetiles", { userData ,productcount });
  } catch (error) {
    console.log(error.message);
  }
};

const updateUserProfile = async (req, res) => {
  try {
    const newId = req.params.id;

    const userData = await User.findOne({ _id: newId });

    if (req.body.username) {
      await User.findByIdAndUpdate({ _id: newId }, { name: req.body.username });
    }
    if (req.body.usermobile) {
      await User.findByIdAndUpdate(
        { _id: newId },
        { mobile: req.body.usermobile }
      );
    }
    res.json({ already: "Upadated Succefully " });
  } catch (error) {
    console.log(error.message);
  }
};

const updateUserPassword = async (req, res) => {
  try {
    const passId = req.params.id;
    const oldPass = req.body.oldpassword;
    const newPass = req.body.newpassword;

    const newPassData = await User.findOne({ _id: passId });
    if (newPassData) {
      const passwordMatch = await bcrypt.compare(
        req.body.oldpassword,
        newPassData.password
      );
      const newSpassword = await securedPassword(req.body.newpassword);

      if (!passwordMatch) {
        res.json({ already: "Please check your Password" });
      } else {
        await User.findByIdAndUpdate(
          { _id: passId },
          { password: newSpassword }
        );
        res.json({ already: "Password changed SuccesFully" });
      }
    }
  } catch (error) {
    console.log(error.message);
  }
};


const loadAddressPage = async (req, res) => {
  try {
    const user=req.session.user
    const cartData = await Cart.find({ userId: user });

    
    let productcount = 0;
    for (const cart of cartData) {
      productcount += cart.products.length;
    }
    
    res.render("user/address",{productcount});
  } catch (error) {
    console.log(error.message);
  }
};


const addUserAddress = async (req, res) => {
  try {
    const userData = await User.findOne({ _id: req.session.user });

    if (userData) {
      const newAddress = new Address({
        name: req.body.username,
        mobile: req.body.usermobile,
        pincode: req.body.pincode,
        address: req.body.address,
        streetaddress: req.body.streetaddress,
        city: req.body.city,
        state: req.body.state,
        landmark: req.body.landmark,
        userId: req.session.user,
        status: false,
      });
      await newAddress.save();
      const message = "New address addedd Succesfully";
      req.flash("succ", message);
      return res.redirect("/userprofile");
    }
  } catch (error) {
    console.log(error.message);
  }
};


const loadEditUser = async (req, res) => {
  try {
    const addressId = req.params.id;

    const addressData = await Address.findOne({ _id: addressId });
    const user=req.session.user
    const cartData = await Cart.find({ userId: user });

    
    let productcount = 0;
    for (const cart of cartData) {
      productcount += cart.products.length;
    }
    

    res.render("user/editaddress", { addressData,productcount });
  } catch (error) {
    console.log(error.message);
  }
};


const updateUserAddress = async (req, res) => {
  try {
    const updateId = req.params.id;

    const aData = await Address.findByIdAndUpdate(
      { _id: updateId },
      {
        name: req.body.username,
        mobile: req.body.usermobile,
        pincode: req.body.pincode,
        address: req.body.address,
        streetaddress: req.body.streetaddress,
        city: req.body.city,
        state: req.body.state,
        landmark: req.body.landmark,
        status: false,
      }
    );

    res.json({ already: "Address changed SuccesFully" });
  } catch (error) {
    console.log(error.message);
  }
};


const deleteUseraddress = async (req, res) => {
  try {
    const dltId = req.params.id;

    const deleteData = await Address.findByIdAndDelete({ _id: dltId });

    res.status(200).json({ message: "deletion successfull" });
  } catch (error) {
    console.log(error.message);
  }
};



module.exports = {
  loadUserProfile,
  resendOtp,
  home,
  backToUserHome,
  loadShopPage,
  loadAboutPage,
  loadContactPage,
  editUseprofile,
  updateUserProfile,
  updateUserPassword,
  loadAddressPage,
  addUserAddress,
  loadEditUser,
  updateUserAddress,
  deleteUseraddress,

};

// ------------------------------End------------------------------------
