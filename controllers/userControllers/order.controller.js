const User = require("../../models/userModel");
const Products = require("../../models/productModel");
const Address = require("../../models/addressModel");
const Cart = require("../../models/cartModel");
const order = require("../../models/orderModal");
const Coupon = require("../../models/couponModal");
const Razorpay = require("razorpay");
const crypto = require("crypto");
const Offer = require("../../models/offerModal");
require("dotenv").config();
var {validatePaymentVerification,} = require("razorpay/dist/utils/razorpay-utils");
const StatusCodes = require("../../constants/status.constants");
const { log } = require("console");

const placeOrder = async (req, res) => {
  try {
    const { activeAddressId, paymentmethod, totalDiscount, couponCode, retryOrderId } = req.body;
    const userId = req.session.user;

    const generateRandomOrderId = (length) => {
      const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
      let result = "";
      for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
      }
      return result;
    };

    const cartData = await Cart.findOne({ userId }).populate("products.productId");

    if (!cartData || cartData.products.length === 0) {
      return res.status(400).json({ success: false, message: "Cart is empty." });
    }

    const outOfStock = cartData.products.find(
      (item) => !item.productId || item.productId.productquadity <= 0 || item.quantity > item.productId.productquadity
    );

    if (outOfStock) {
      return res.json({
        success: false,
        message: `Product "${outOfStock.productId?.productname || 'Unknown'}" is out of stock or has insufficient quantity.`,
      });
    }

    const currentAddress = await Address.findById(activeAddressId);

    const orderedItems = [];

    // ✅ Loop and calculate offer-adjusted prices
    for (const cartItem of cartData.products) {
      const product = cartItem.productId;
      let productPrice = product.productprice;
      let offerPercentage = 0;

      // Check for product-wise offer
      if (product.offerId) {
        const offer = await Offer.findOne({
          _id: product.offerId,
          status: "active",
          expiryDate: { $gte: new Date() }
        });
        if (offer) {
          offerPercentage = offer.percentage;
        }
      }

      // If no product-wise offer, check for category-wise offer
      if (offerPercentage === 0) {
        const categoryOffer = await Offer.findOne({
          offerType: "category",
          offerTypeName: product.categoryId,
          status: "active",
          expiryDate: { $gte: new Date() }
        });
        if (categoryOffer) {
          offerPercentage = categoryOffer.percentage;
        }
      }

      // Apply discount if available
      if (offerPercentage > 0) {
        productPrice = Math.round(productPrice - (productPrice * offerPercentage) / 100);
      }

      const totalProductAmount = productPrice * cartItem.quantity;

      orderedItems.push({
        productId: product._id,
        quantity: cartItem.quantity,
        productStatus: "pending",
        totalProductAmount
      });
    }

    const orderAmount = orderedItems.reduce((total, item) => total + item.totalProductAmount, 0);
    const orderId = retryOrderId || "order_" + generateRandomOrderId(9);

    const baseOrderData = {
      userId,
      cartId: cartData._id,
      orderId,
      orderedItem: orderedItems,
      orderAmount: totalDiscount,
      deliveryAddress: currentAddress,
      paymentStatus: "pending",
      deliveryDate: new Date(),
      shippingDate: new Date(),
      paymentMethod: paymentmethod,
    };

    // ✅ RazorPay Payment
    if (paymentmethod === "RazorPay") {
      const options = {
        amount: totalDiscount * 100,
        currency: "INR",
        receipt: crypto.randomBytes(10).toString("hex"),
      };

      const razorpayInstance = new Razorpay({
        key_id: process.env.RAZORPAY_ID_KEY,
        key_secret: process.env.RAZORPAY_SECRET_ID,
      });

      razorpayInstance.orders.create(options, (err, order) => {
        if (err) {
          return res.json({ success: false });
        } else {
          req.session.newOrders = baseOrderData;
          return res.json({
            success: true,
            order: order,
            order_id: order.id,
            key_id: process.env.RAZORPAY_ID_KEY,
            paymentMethod: paymentmethod,
            couponCode,
            retryOrderId: orderId,
          });
        }
      });

    // ✅ COD
    } else if (paymentmethod === "Cash On Delivery") {
      if (totalDiscount > 1000) {
        return res.json({ message: "failed", paymentMethod: "COD" });
      }

      const newOrder = new order(baseOrderData);
      await newOrder.save();

      for (const item of orderedItems) {
        await Products.findOneAndUpdate(
          { _id: item.productId },
          { $inc: { productquadity: -item.quantity } }
        );
      }

      if (couponCode) {
        await Coupon.findOneAndUpdate(
          { couponCode },
          { $push: { usedUser: { userId, used: true } } },
          { new: true }
        );
        const couponData = await Coupon.findOne({ couponCode });
        await order.findByIdAndUpdate(
          newOrder._id,
          { $set: { couponDeduction: couponData.discountAmount } }
        );
      }

      await Cart.deleteOne({ userId });
      return res.json({ newOrder, paymentmethod });

    // ✅ Wallet
    } else if (paymentmethod === "Wallet") {
      const WalletUserData = await User.findById(userId);
      const walletMoney = WalletUserData.wallet;

      if (walletMoney < totalDiscount) {
        return res.json({
          message: "failed",
          paymentMethod: "Wallet",
          alertMessage: "Insufficient Fund"
        });
      }

      const walletNewOrder = new order({
        ...baseOrderData,
        paymentStatus: "Payment Successful",
      });
      await walletNewOrder.save();

      for (const item of orderedItems) {
        await Products.findOneAndUpdate(
          { _id: item.productId },
          { $inc: { productquadity: -item.quantity } }
        );
      }

      if (couponCode) {
        await Coupon.findOneAndUpdate(
          { couponCode },
          { $push: { usedUser: { userId, used: true } } },
          { new: true }
        );
        const couponData = await Coupon.findOne({ couponCode });
        await order.findByIdAndUpdate(
          walletNewOrder._id,
          { $set: { couponDeduction: couponData.discountAmount } }
        );
      }

      const updatedWallet = walletMoney - totalDiscount;

      await User.findByIdAndUpdate(userId, {
        $set: { wallet: updatedWallet },
        $push: {
          walletHistory: {
            amount: totalDiscount,
            description: `Payment for ORDERID:${walletNewOrder._id}`,
            date: new Date(),
            status: "Debit"
          }
        }
      });

      await Cart.deleteOne({ userId });
      return res.json({ walletNewOrder, paymentmethod });
    }

  } catch (error) {
    console.error("error:", error.message);
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).send("Internal server error");
  }
};



const retryPayment = async (req, res) => {
  
  try {
    const { orderId } = req.body;
    const existingOrder = await order.findOne({_id: orderId });
    if (!existingOrder) {
      return res.status(StatusCodes.NOT_FOUND).json({ success: false, message: "Order not found" });
    }

    const options = {
      amount: existingOrder.orderAmount * 100,
      currency: "INR",
      receipt: crypto.randomBytes(10).toString("hex"),
    };

    const razorpayInstance = new Razorpay({
      key_id: process.env.RAZORPAY_ID_KEY,
      key_secret: process.env.RAZORPAY_SECRET_ID,
    });

    razorpayInstance.orders.create(options, (err, order) => {
      if (err) {
        console.log("Retry payment error:", err);
        res.json({ success: false, message: "Failed to create retry payment" });
      } else {
        res.json({
          success: true,
          order: order,
          order_id: order.id,
          key_id: process.env.RAZORPAY_ID_KEY,
          retryOrderId: existingOrder.orderId,
          initial_ID:orderId
        });
      }
    });
  } catch (error) {
    console.error("Retry payment error:", error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ success: false, message: "Internal server error" });
  }
};

const   loadOrderPage = async (req, res) => {
  try {
    const orderId = req.params.id;    

    const orderData = await order
      .find({ _id: orderId })
      .populate("orderedItem.productId")
      .populate("deliveryAddress")
      .populate("userId")

      
    const user = req.session.user
    const cartData = await Cart.find({ userId: user });
    
    let productcount = 0;
    for (const cart of cartData) {
      productcount += cart.products.length;
    }

    
    res.render("user/orders", { orderData, productcount });
  } catch (error) {
    console.log(error.message);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).send("Internal Server Error");
  }
};

const orderCancel = async (req, res) => {
  try {
    const { productId, orderId } = req.body;
    const userId = req.session.user;
    
    const orderData = await order.findOne({_id: orderId})
      .populate("orderedItem.productId")
      .populate("deliveryAddress")
      .populate("userId")
    
    const paymentMethod = orderData.paymentMethod
    const paymentStatus = orderData.paymentStatus

    let quantity = 0;
    let productAmount = 0;
    
    for (const item of orderData.orderedItem) {
      if (item.productId._id.toString() === productId) {
        quantity = item.quantity;
        productAmount = item.totalProductAmount;
        break;
      }
    }

    await order.findOneAndUpdate(
      { _id: orderId, "orderedItem.productId": productId },
      { $set: { "orderedItem.$.productStatus": "Order Cancelled" } }
    );
    if(paymentStatus!== "pending"){

    

    if(paymentMethod === "Wallet" || paymentMethod === "RazorPay" || paymentMethod === "Cash On Delivery") {
      await User.findByIdAndUpdate(userId, {
        $inc: { wallet: productAmount }, 
        $push: {
          walletHistory: {
            amount: productAmount,
            description: `Refund of ORDERID:${orderId}`,
            date: new Date(),
            status: "credit"
          }
        }
      }, { new: true });
    }
  }

    await Products.findOneAndUpdate(
      { _id: productId },
      { $inc: { productquadity: +quantity } }
    );

    res.status(StatusCodes.OK).json({ message: "deletion successful" });
  } catch (error) {
    console.log(error.message);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: "Internal server error" }); 
  }
};

const verifyOrder = async (req, res) => {
  try {
    const { razorpay_signature, order_id, paymentId, couponCode } = req.body;
    let key_secret = process.env.RAZORPAY_SECRET_ID;
    const userId = req.session.user;
    const cartData = await Cart.findOne({ userId }).populate("products.productId");

    const orderedItems = cartData.products.map((product) => {
      const totalProductAmount = product.quantity * (product.productId?.price || 0);
      return {
        productId: product.productId,
        quantity: product.quantity,
        productStatus: "pending",
        totalProductAmount: product.totalPrice,
      };
    });

    let newOrder = req.session.newOrders;

    const curentData = new order({
      userId: newOrder.userId,
      cartId: newOrder.cartId,
      orderId: newOrder.orderId,
      orderedItem: newOrder.orderedItem,
      orderAmount: newOrder.orderAmount,
      deliveryAddress: newOrder.deliveryAddress,
      paymentStatus: "pending",
      deliveryDate: newOrder.deliveryDate,
      shippingDate: newOrder.deliveryDate,
      paymentMethod: newOrder.paymentMethod,
    });

    await curentData.save();
    const cId = curentData._id;

    var success = validatePaymentVerification(
      { order_id: order_id, payment_id: paymentId },
      razorpay_signature,
      key_secret
    );

    
    
    if (!success) {
      await order.findByIdAndUpdate(
        { _id: cId },
        { paymentStatus: "Payment Failed" }
      );
      res.status(StatusCodes.BAD_REQUEST).json({ 
        success: false, 
        message: "Payment verification failed",
        orderId: curentData.orderId,
        curentData: cId
      });
    } else {
      await order.findByIdAndUpdate(
        { _id: cId },
        { paymentStatus: "Payment Successful" }
      );

      for (const item of orderedItems) {
        const productId = item.productId;
        const quantity = item.quantity;

        await Products.findOneAndUpdate(
          { _id: productId },
          { $inc: { productquadity: -quantity } }
        );
      }

      if (couponCode) {
        const couponData = await Coupon.findOneAndUpdate(
          { couponCode: couponCode },
          { $push: { usedUser: { userId: req.session.user, used: true } } },
          { new: true }
        )
        const couponDeduction = await Coupon.findOne({ couponCode: couponCode })
        const discountAmount1 = couponDeduction.discountAmount
        await order.findOneAndUpdate(
          { _id: curentData._id },
          { $set: { couponDeduction: discountAmount1 } }, 
          { new: true }
        )
      }

      await Cart.deleteOne({ userId: req.session.user });
      res.status(StatusCodes.OK).json({
        success: true,
        message: "Payment verification successful",
        curentData: curentData._id,
      });
    }
  } catch (error) {
    console.log(error.message);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).send("Internal server error");
  }
};


const verifyCoupon = async (req, res) => {
  try {
    const { couponCode, totalDiscount } = req.body;
    const userId = req.session.user;
    const couponData = await Coupon.findOne({ couponCode: couponCode })
 
    const cartDetiles = await Cart.find({ userId: userId }).populate("products.productId");

    let total = 0;
    cartDetiles.forEach((item) => {
      item.products.forEach((product) => {
        total += product.totalPrice
      });
    });
 
    if (couponData === null) {
      return res.json({ message: "Coupon not found" });
    }
    const couponDiscount = couponData.discountAmount
    if(couponData.expiryDate < Date.now()) {
      return res.json({message: "Coupon Expired"})
    }

    if (totalDiscount < couponData.minAmount) {
      return res.json({ message: "minimum total amount required" })
    }

    const userFound = couponData.usedUser.find(user => user.userId.toString() === req.session.user);
 
    if (userFound) {
      return res.json({ message: "Coupon already used" });
    } else {
      let sumTotal = total - couponData.discountAmount;
      return res.status(StatusCodes.OK).json({
        message: "coupon added Successfully", 
        total: sumTotal,
        couponDiscount: couponDiscount
      });
    }
  } catch (error) {
    console.log(error.message);
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: "Internal server error" });
  }
};

const userReturnProduct = async (req, res) => {
  try {
    const {productId, order_id, paymentMethod, quantity, totalProductAmount, reason} = req.body
    const userId = req.session.user;

    if(paymentMethod === "Cash On Delivery") {
      const updatedOrder = await order.findOneAndUpdate(
        { _id: order_id, 'orderedItem.productId': productId },
        { $set: { 
          'orderedItem.$.productStatus': 'Return Requested',
          'orderedItem.$.returnRequest': true,
          'orderedItem.$.returnReason': `${reason}`
        } },
        { new: true }
      );
    } else if (paymentMethod === "RazorPay") {
      const updatedOrder = await order.findOneAndUpdate(
        { _id: order_id, 'orderedItem.productId': productId },
        { $set: { 
          'orderedItem.$.productStatus': 'Return Requested',
          'orderedItem.$.returnRequest': true,
          'orderedItem.$.returnReason': `${reason}`
        } },
        { new: true }
      );
    } else if(paymentMethod === "Wallet") {
      const updatedOrder = await order.findOneAndUpdate(
        { _id: order_id, 'orderedItem.productId': productId },
        { $set: { 
          'orderedItem.$.productStatus': 'Return Requested',
          'orderedItem.$.returnRequest': true,
          'orderedItem.$.returnReason': `${reason}`
        } },
        { new: true }
      );
    }

    res.json({message: "Return requested Successfully"})
  } catch (error) {
    console.log(error.message)
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: "Internal server error" });
  }
}

const removeCoupon = async (req, res) => {
  try {
    const {couponCode} = req.body
    const userId = req.session.user

    const couponData = await Coupon.findOne({couponCode: couponCode})

    if (!couponData) {
      return res.status(StatusCodes.NOT_FOUND).json({ message: "Coupon not found" });
    }
   
    res.json({message: "founded"})
  } catch (error) {
    console.log(error.message)
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: "Internal server error" });
  }
}

const retryPaymentVerification = async (req, res) => {
  
  try {
    const { razorpay_signature, order_id, paymentId, couponCode,initial_ID } = req.body;


    let key_secret = process.env.RAZORPAY_SECRET_ID;
    const userId = req.session.user;
    
    const cartData = await Cart.findOne({ userId }).populate("products.productId");
    
    const existingOrder = await order.findOne({ _id: initial_ID });
    if (!existingOrder) {
      return res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        message: "Order not found",
      });
    }
  

    const orderedItems = cartData.products.map((product) => {
      const totalProductAmount = product.quantity * (product.productId?.price || 0);
      return {
        productId: product.productId,
        quantity: product.quantity,
        productStatus: "pending",
        totalProductAmount: product.totalPrice,
      };
    });
    
   
    

    var success = validatePaymentVerification(
      { order_id: order_id, payment_id: paymentId },
      razorpay_signature,
      key_secret
    );


    if (!success) {
      await order.findByIdAndUpdate(
        { _id: initial_ID},
        { paymentStatus: "Payment Failed" }
      );
      res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: "Retry payment verification failed",
        orderId: initial_ID,
        orderData: initial_ID,
      });
    } else {
      await order.findByIdAndUpdate(
        { _id: initial_ID },
        { paymentStatus: "Payment Successful" }
      );

      for (const item of orderedItems) {
        const productId = item.productId;
        const quantity = item.quantity;

        await Products.findOneAndUpdate(
          { _id: productId },
          { $inc: { productQuantity: -quantity } }
        );
      }

      if (couponCode) {
        const couponData = await Coupon.findOneAndUpdate(
          { couponCode: couponCode },
          { $push: { usedUser: { userId: req.session.user, used: true } } },
          { new: true }
        );
        const couponDeduction = await Coupon.findOne({ couponCode: couponCode });
        const discountAmount1 = couponDeduction.discountAmount;
        await order.findOneAndUpdate(
          { _id: initial_ID },
          { $set: { couponDeduction: discountAmount1 } },
          { new: true }
        );
      }

      await Cart.deleteOne({ userId: req.session.user });
      res.status(StatusCodes.OK).json({
        success: true,
        message: "Retry payment verification successful",
        orderData: initial_ID,
      });
    }
  } catch (error) {
    console.log("error from retryPaymentVerification",error.message);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).send("Internal server error");
  }
};


module.exports = {
  removeCoupon,
  userReturnProduct,
  verifyCoupon,
  verifyOrder,
  orderCancel,
  loadOrderPage,
  placeOrder,
  retryPayment,
  retryPaymentVerification
}