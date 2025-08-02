const User = require("../../models/userModel");
const Otp = require("../../models/otp");
const bcrypt = require("bcrypt");
const Address = require("../../models/addressModel");
const Cart = require("../../models/cartModel");
const order = require("../../models/orderModal");
const Coupon = require("../../models/couponModal");
const Category = require("../../models/categoryModel");
const Products = require("../../models/productModel")
const { securedPassword } = require("../../helpers/passwordHelper");
const StatusCodes = require("../../constants/status.constants");

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
      const message = req.flash("succ")
      
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
    const userId = req.params.id;
    const updates = {};

    if (req.body.username) {
      updates.name = req.body.username;
    }
    if (req.body.usermobile) {
      updates.mobile = req.body.usermobile;
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      updates,
      { new: true }
    );

    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.json({
      success: true,
      message: "Updated Successfully",
      username: updatedUser.name,
      usermobile: updatedUser.mobile,
    });
  } catch (error) {
    console.log(error.message);
    res.status(500).json({
      success: false,
      error: "Update failed",
    });
  }
};





const updateUserPassword = async (req, res) => {
  try {
    const userId = req.params.id;
    const { oldpassword, newpassword } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(StatusCodes.NOT_FOUND).json({ error: "User not found" });
    }

    const isMatch = await bcrypt.compare(oldpassword, user.password);
    if (!isMatch) {
      return res.status(StatusCodes.UNAUTHORIZED).json({ error: "Incorrect current password" });
    }

    const hashedPassword = await securedPassword(newpassword);

    await User.findByIdAndUpdate(userId, { password: hashedPassword });
    res.status(StatusCodes.OK).json({ message: "Password changed successfully" });
  } catch (error) {
    console.error("Error updating password:", error.message);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: "Internal server error" });
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
    
    res.status(StatusCodes.OK).render("user/address",{productcount});
  } catch (error) {
    console.log(error.message);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).send("Internal Server Error");
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
      return res.status(StatusCodes.OK).redirect("/userprofile");
    }
  } catch (error) {
    console.log(error.message);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).send("Internal Server Error");
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
    

    res.status(StatusCodes.OK).render("user/editaddress", { addressData,productcount });
  } catch (error) {
    console.log(error.message);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).send("Internal Server Error");
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

    res.status(StatusCodes.OK).json({ already: "Address changed SuccesFully" });
  } catch (error) {
    console.log(error.message);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).send("Internal Server Error");
  }
};


const deleteUseraddress = async (req, res) => {
  try {
    const dltId = req.params.id;

    const deleteData = await Address.findByIdAndDelete({ _id: dltId });

    res.status(StatusCodes.OK).json({ message: "deletion successfull" });
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
