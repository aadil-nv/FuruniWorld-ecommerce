const Products = require("../../models/productModel");
const Cart = require("../../models/cartModel");
const Offer = require("../../models/offerModal");
require("dotenv").config();




const loadViewCart = async (req, res) => {
  try {
    const user = req.session.user;

    const cartDetiles = await Cart.find({ userId: user }).populate("products.productId").populate({path:'products.productId',populate:{path:"offerId",model:"offer"}})
    let total = 0;

   let productcount=0

    for (const cart of cartDetiles) {
      for (const item of cart.products) {
        const product = item.productId;

        let totalPrice = product.productprice * item.quantity;

      
        if (product.offerId) {
          const offer = await Offer.findById(product.offerId);
          if (offer && offer.status === "active") {
            const discountedPrice = totalPrice * (1 - offer.percentage / 100);
            totalPrice = discountedPrice;
          }
        }

        item.totalPrice = totalPrice;
        total += totalPrice;
        productcount++
      }
    }
    
 

    res.render("user/cart", { cartDetiles, total ,productcount});
  } catch (error) {
    console.error(error.message);
    res.status(500).send("Internal Server Error");
  }
};

const quantityControll = async (req, res) => {
  try {
    const { change, qty } = req.body;
   
    const user = req.session.user;
    const product = await Products.findOne({ _id: change }).populate('offerId');
    
    const productQuantity = product.productquadity;
   

    let total = qty * product.productprice;

   
    if (product.offerId) {
      const productOffer = product.offerId.percentage;
      total = total * (100 - productOffer) / 100;
    }


    if (qty > productQuantity) {
      return res.json({ message: "Out of Stock" });
    }

 
    await Cart.findOneAndUpdate(
      { userId: req.session.user, "products.productId": change },
      { $set: { "products.$.quantity": qty, "products.$.totalPrice": total } },
      { new: true }
    );

    
    const cartDetiles = await Cart.find({ userId: user }).populate("products.productId").populate({path:'products.productId',populate:{path:"offerId",model:"offer"}})
    
    let totalAmount = 0;
    cartDetiles.forEach((item) => {
      item.products.forEach((product) => {
        let productTotal = product.quantity * product.productId.productprice;
       
        if (product.productId.offerId) {
          const productOffer = product.productId.offerId.percentage;
          productTotal = productTotal * (100 - productOffer) / 100;
        }
        totalAmount += productTotal;
      });
    });

    await Cart.findOneAndUpdate(
      { userId: user },
      { $set: { total: totalAmount } },
      { new: true }
    );

    res.json({ totalAmount, productQuantity });
  } catch (error) {
    console.error(error.message);
    res.status(500).send("Internal Server Error");
  }
};

const deleteCartProduct = async (req, res) => {
  try {
    const deleteId = req.params.id;
    const userId = req.session.user;
    const cart = await Cart.findOne({ userId: userId });

    if (!cart) {
      return res.status(404).json({ error: "Cart not found" });
    }

    let totalPriceToRemove = 0;

    for (const product of cart.products) {
      if (product.productId.toString() === deleteId) {
        totalPriceToRemove = product.totalPrice;
        break;
      }
    }

    const updatedCart = await Cart.findOneAndUpdate(
      { userId: userId },
      { $pull: { products: { productId: deleteId } },
        $inc: { total: -totalPriceToRemove }
     },
      { new: true }
    );

    if (!updatedCart) {
      return res.status(404).json({ error: "Cart not found" });
    }
    res.status(200).json({ message: "deletion successfull" });

  } catch (error) {
    console.log(error.message);
  }
};

const headerCount= async (req,res)=>{
  try {
    const userId= req.session.user 
    let cartCount = 0; // Initialize cartCount to 0
    
    if (userId) {
      const cartData = await Cart.findOne({ userId }); // Assuming Cart is your Mongoose model
      
      if (cartData && Array.isArray(cartData.products) && cartData.products.length > 0) {
        // Sum up the quantities of all products in the cart
        cartCount = cartData.products.reduce((total, product) => total + product.quantity, 0);
      }
    }
    res.send('/partials/maiheader',{cartCount})
  } catch (error) {
    console.log(error.message)
  }
}


module.exports={
    loadViewCart,
    quantityControll,
    deleteCartProduct,
    headerCount
    
}