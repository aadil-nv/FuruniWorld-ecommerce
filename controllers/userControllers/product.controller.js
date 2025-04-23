const Products = require("../../models/productModel");
const Cart = require("../../models/cartModel");
require("dotenv").config();



const loadProductTab = async (req, res) => {
  try {
    const productId = req.params.id;
    const user=req.session.user
    const cartData = await Cart.find({ userId: user });

    
    let productcount = 0;
    for (const cart of cartData) {
      productcount += cart.products.length;
    }
    const savedData = await Products.findById(productId).populate("offerId");

    if (savedData) {
      return res.render("user/producttab", { savedData: savedData ,productcount});
    }
    res.redirect("index");
  } catch (error) {
    console.log(error.message);
  }
};
const addProductInCart = async (req, res) => {
  try {
    const productId = req.params.id;
    const userId = req.session.user;

    const existingProduct = await Cart.findOne({userId: userId,"products.productId": productId,});
    const productData2 = await Products.findById(productId).populate("offerId");

    if (productData2.productquadity === 0) {
      return res.status(400).json({ message: "Product is out of stock" });
    }

    if (existingProduct) {
      return res.status(400).json({ message: "Product already in cart" });
    }

    const productData = await Products.findById(productId).populate("offerId")
    let totalPrice = productData.productprice;
    
    if (productData.offerId) {
      const offerPercentage = productData.offerId.percentage;
      totalPrice = totalPrice * (100 - offerPercentage) / 100;
    }
    
    const add = await Cart.findOneAndUpdate(
      { userId: req.session.user },
      {$addToSet: {products: {productId: productId,quantity: 1,totalPrice: totalPrice,},},
      $inc: { total: totalPrice },
      },
      { new: true, upsert: true });


    res.status(200).json({ message: "Product added to cart successfully" });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ message: "Internal server error" });
  }
};
const loadtCheckoutPage = async (req, res) => {
  try {
    const userId = req.session.user;

    const addressData = await Address.find({ userId: userId });
    const cartDetiles = await Cart.find({ userId: userId }).populate("products.productId").populate({path:'products.productId',populate:{path:"offerId",model:"offer"}});

    let total = 0;

    for (const cart of cartDetiles) {
      for (const item of cart.products) {
        let productTotal = item.quantity * item.productId.productprice;

        if (item.productId.offerId) {
          const offerPercentage = item.productId.offerId.percentage;
          const discountedPrice = productTotal * (100 - offerPercentage) / 100;
          productTotal = discountedPrice;
        }

        total += productTotal;
      }
    }

    const user=req.session.user
    const cartData = await Cart.find({ userId: user });

    
    let productcount = 0;
    for (const cart of cartData) {
      productcount += cart.products.length;
    }

    res.render("user/checkout", { addressData, cartDetiles, total,productcount });
  } catch (error) {
    console.error(error.message);
  }
};
const editUseraddressInCheckout = async (req, res) => {
  try {
    const editCheckId = req.params.id;
    const userId = req.session.user;
    const addressDataSecond = await Address.findOne({ _id: editCheckId });

    res.json({ addressDataSecond });
  } catch (error) {
    console.log(error.message);
  }
};
const updatecartAddress = async (req, res) => {
  try {
    const {
      addressId,
      username,
      usermobile,
      address,
      streetaddress,
      pincode,
      state,
      landmark,
      city,
    } = req.body;

    const aData = await Address.findByIdAndUpdate(
      { _id: addressId },
      {
        name: username,
        mobile: usermobile,
        pincode: pincode,
        address: address,
        streetaddress: streetaddress,
        city: city,
        state: state,
        landmark: landmark,
        status: false,
      }
    );
    res.json({ message: "successfully" });
  } catch (error) {
    console.log(error.message);
  }
};

const addCheckoutAddress = async (req, res) => {
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
      return res.redirect("/checkoutpage");
    }
  } catch (error) {
    console.log(error.message);
  }
};
const proceedToCheckout= async (req,res)=>{
    try {
  
      const user = req.session.user;
  
      const cartDetiles = await Cart.findOne({ userId: user }).populate("products.productId");
  
     
      let message = "";
      if (!cartDetiles    ) {
        message = "Please ad Products in cart"
        return res.send(message)
        
      }
  
     
      for (let i = 0; i < cartDetiles.products.length; i++) {
        const product = cartDetiles.products[i];
        if (product.productId.productquadity === 0) {
          
          message = "Please remove out-of-stock items from the cart.";
        }
      }
      
      if (cartDetiles.products.length===0) {
        message = "Please ad Products in cart";
      }
  
      res.send(message || "Proceed to checkout");
    } catch (error) {
      console.log(error.message)
    }
  }
  

  module.exports ={
    loadProductTab,
    addProductInCart,
    loadtCheckoutPage,
    editUseraddressInCheckout,
    updatecartAddress,
    addCheckoutAddress,
    proceedToCheckout
  }