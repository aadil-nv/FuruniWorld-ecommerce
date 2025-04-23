const User = require("../../models/userModel");
const Products = require("../../models/productModel");
const Address = require("../../models/addressModel");
const Cart = require("../../models/cartModel");
const order = require("../../models/orderModal");
const Coupon = require("../../models/couponModal");
const Razorpay = require("razorpay");
const crypto = require("crypto");
require("dotenv").config();
var {
  validatePaymentVerification,
} = require("razorpay/dist/utils/razorpay-utils");



const placeOrder = async (req, res) => {

  try {
    console.log("comigggggggggggggggggggggggggggggggggggg")
    const { activeAddressId, paymentmethod, totalDiscount, couponCode } = req.body;

    const generateRandomOrderId = (length) => {
      const characters =
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
      let result = "";
      for (let i = 0; i < length; i++) {
        result += characters.charAt(
          Math.floor(Math.random() * characters.length)
        );
      }
      return result;
    };

    const userId = req.session.user;
   
    const cartData = await Cart.findOne({ userId }).populate("products.productId");

    const currentAddress = await Address.findById(activeAddressId);

    const orderedItems = cartData.products.map((product) => {
      const totalProductAmount =product.quantity * (product.productId?.price || 0);
      return {
        productId: product.productId,
        quantity: product.quantity,
        productStatus: "pending",
        totalProductAmount: product.totalPrice,
      };
    });

    const orderAmount = orderedItems.reduce(
      (total, item) => total + item.totalProductAmount,0);

    const orderId = "order_" + generateRandomOrderId(9);

    let newOrder = new order({
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
    });

    req.session.newOrders = newOrder;

    if (paymentmethod === "RazorPay") {
      console.log("razoooooooooooooooooooooorrrrrrrrrrrr")
      const options = {
        amount: totalDiscount * 100,
        currency: "INR",
        receipt: crypto.randomBytes(10).toString("hex"),
      };
      

      console.log("process.env.RAZORPAY_ID_KEY",process.env.RAZORPAY_ID_KEY);
      console.log("process.env.RAZORPAY_SECRET_ID",process.env.RAZORPAY_SECRET_ID);
      
      const razorpayInstance = new Razorpay({
        key_id: process.env.RAZORPAY_ID_KEY ,
        key_secret: process.env.RAZORPAY_SECRET_ID,
      });
//todo------------------------------------------------------------------
razorpayInstance.orders.create(options,(err, order) => {
  if (err) {
    console.log("founded---------",err);
    res.json({ success: false });
  } else {
    res.json({
      order: order,
      success: true,  
      order_id: order.id,
      key_id: "rzp_test_GFUUN1I3GCgAO2",
      paymentMethod: paymentmethod,
      couponCode: couponCode
    });
  }
});

    } else if(paymentmethod === "Cash On Delivery") {

      if(totalDiscount>1000){
        return res.json({message:"failed"})
      }
      await newOrder.save();

      for (const item of orderedItems) {
        const productId = item.productId;
        const quantity = item.quantity;

        await Products.findOneAndUpdate(
          { _id: productId },
          { $inc: { productquadity: -quantity } });}

      if (couponCode) {
        
        const couponData = await Coupon.findOneAndUpdate(
          { couponCode: couponCode },
          { $push: { usedUser: { userId: req.session.user, used: true } } },
          { new: true }
        )
        const couponDeduction = await Coupon.findOne({ couponCode: couponCode })
        const discountAmount1 = couponDeduction.discountAmount
        await order.findOneAndUpdate(
          { _id: newOrder._id },
          { $set: { couponDeduction: discountAmount1 } }, { new: true })

      }


      await Cart.deleteOne({ userId: req.session.user });
      res.json({ newOrder, paymentmethod });

    }else if(paymentmethod === "Wallet"){

      const WalletUserData= await User.findById({_id:userId})
      const walletMoney=WalletUserData.wallet

      if(walletMoney <= totalDiscount ){
        console.log("Wallet Payment failed InsuficiantFund")
        return res.json({message:"Failed"})
        
      }else{

        let walletNewOrder = new order({
          userId,
          cartId: cartData._id,
          orderId,
          orderedItem: orderedItems,
          orderAmount: totalDiscount,
          deliveryAddress: currentAddress,
          paymentStatus: "Payment Successfull",
          deliveryDate: new Date(),
          shippingDate: new Date(),
          paymentMethod: paymentmethod,
        });

          await walletNewOrder.save()

          for (const item of orderedItems) {
            const productId = item.productId;
            const quantity = item.quantity;
    
            await Products.findOneAndUpdate(
              { _id: productId },
              { $inc: { productquadity: -quantity } });}

              if (couponCode) {
        
                const couponData = await Coupon.findOneAndUpdate(
                  { couponCode: couponCode },
                  { $push: { usedUser: { userId: req.session.user, used: true } } },
                  { new: true }
                )
                const couponDeduction = await Coupon.findOne({ couponCode: couponCode })
                const discountAmount1 = couponDeduction.discountAmount
                await order.findOneAndUpdate(
                  { _id: walletNewOrder._id },
                  { $set: { couponDeduction: discountAmount1 } }, { new: true })
              }

              const userData= await User.findById({_id:userId})
              const walletMoney= userData.wallet
              const balanceWallet=walletMoney-totalDiscount
              

              const updatedUser = await User.findByIdAndUpdate(userId, {
                $set: { wallet: balanceWallet }, 
                $push: {
                    walletHistory: {
                        amount: balanceWallet,
                        description: `Refund of ORDERID:${walletNewOrder._id}`,
                        date: new Date(),
                        status: "Debit"
                    }
                }
                }, { new: true });


              await Cart.deleteOne({ userId: req.session.user });
             console.log("Wallet Payment successfulll")
        return res.json({walletNewOrder,paymentmethod})
      }
    }

  } catch (error) {
    console.log("errror : ", error);
    console.error(error.message);
    res.status(500).send("Internal server error");
  }
};


const loadOrderPage = async (req, res) => {
  try {
    const orderId = req.params.id;

    const orderData = await order
      .find({ _id: orderId })
      .populate("orderedItem.productId")
      .populate("deliveryAddress")
      .populate("userId")

      const user=req.session.user
    const cartData = await Cart.find({ userId: user });

    
    let productcount = 0;
    for (const cart of cartData) {
      productcount += cart.products.length;
    }

    res.render("user/orders", { orderData,productcount });
  } catch (error) {
    console.log(error.message);
  }
};


const orderCancel = async (req, res) => {
  try {
 
    const { productId, orderId } = req.body;

    const userId = req.session.user;
    
   
    const orderData= await order.findOne({_id:orderId}).populate("orderedItem.productId")
    .populate("deliveryAddress")
    .populate("userId")
    
    const paymentMethod=orderData.paymentMethod

    let quantity = 0;

    
    for (const item of orderData.orderedItem) {
      if (item.productId._id.toString() === productId) {
        quantity = item.quantity;
        break; 
      }
    }
    let productAmount=0
    for (const item of orderData.orderedItem) {
      if (item.productId._id.toString() === productId) {
        productAmount = item.totalProductAmount;
        break; 
      }
    }

    await order.findOneAndUpdate(
      { _id: orderId, "orderedItem.productId": productId },
      { $set: { "orderedItem.$.productStatus": "Order Cancelled" } }
    );

    if(paymentMethod === "Wallet" || paymentMethod === "RazorPay"){
      
      await User.findByIdAndUpdate(userId, {
        $inc: { wallet:productAmount }, 
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


    await Products.findOneAndUpdate(
      { _id: productId },
      { $inc: { productquadity: +quantity } }
    );

    res.status(200).json({ message: "deletion successfull" });
  } catch (error) {
    console.log(error.messsage);
  }
};

const verifyOrder = async (req, res) => {
  try {
    console.log("coming to verify order")
    const { razorpay_signature, order_id, paymentId, couponCode } = req.body;
    let key_secret = "3YCQ9l2sEZLArOQHqYYdfiLc";
    const userId = req.session.user;
    const cartData = await Cart.findOne({ userId }).populate(
      "products.productId"
    );

    const orderedItems = cartData.products.map((product) => {
      const totalProductAmount =
        product.quantity * (product.productId?.price || 0);
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
        { paymentStatus: "Payment Failed" });
        console.log("--------------payment failed ----------------")

      res.status(400).json({ success: false, message: "Payment verification failed" });

    } else {
  
      await order.findByIdAndUpdate({ _id: cId },{ paymentStatus: "Payment Successfull" });

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
          { $set: { couponDeduction: discountAmount1 } }, { new: true })
      }
      

      await Cart.deleteOne({ userId: req.session.user });
      res.status(200).json({success: true,message: "Payment verification successful",curentData: curentData._id,});
    }
  } catch (error) {
    console.log(error.message);
    res.status(500).send("Internal server error");
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
 
    if (couponData===null) {
     
      return res.json({ message: "Coupon not found" });
    }
    const couponDiscount= couponData.discountAmount
    if(couponData.expiryDate < Date.now()){
     
      return res.json({message: "Coupon Expired"})

    }

    if (totalDiscount < couponData.minAmount) {
      return res.json({ message: "minmum total amount require" })
    }


    const userFound = couponData.usedUser.find(user => user.userId.toString() === req.session.user);
 
    if (userFound || undefined) {
      return res.json({ message: "Coupon already used" });
    } else {
      let sumTotal = total - couponData.discountAmount;
      return res.status(200).json({message:"coupon added Successfully", total: sumTotal,couponDiscount:couponDiscount });

    }
  } catch (error) {
    console.log(error.message);
    return res.status(500).json({ message: "Internal server error" });
  }
};


const userReturnProduct = async  (req,res)=>{
  try {
    const{productId, order_id,paymentMethod,quantity,totalProductAmount, reason}=req.body
    const userId = req.session.user;
   

    if(paymentMethod==="Cash On Delivery"){


    const updatedOrder = await order.findOneAndUpdate(
      { _id: order_id, 'orderedItem.productId': productId },
      { $set: { 'orderedItem.$.productStatus': 'Return Requested',
      'orderedItem.$.returnRequest': true,
      'orderedItem.$.returnReason': `${reason}`} },
      { new: true });

    }else if (paymentMethod==="RazorPay"){

      const updatedOrder = await order.findOneAndUpdate(
      { _id: order_id, 'orderedItem.productId': productId },
      { $set: { 'orderedItem.$.productStatus': 'Return Requested',
      'orderedItem.$.returnRequest': true,
      'orderedItem.$.returnReason': `${reason}`} },
      { new: true });

    }else if(paymentMethod==="Wallet"){

      const updatedOrder = await order.findOneAndUpdate(
      { _id: order_id, 'orderedItem.productId': productId },
      { $set: { 'orderedItem.$.productStatus': 'Return Requested',
      'orderedItem.$.returnRequest': true ,
      'orderedItem.$.returnReason': `${reason}`} },
      { new: true });

      

    }

    res.json({message :"Return requested Successfully"})
    
  } catch (error) {
    console.log(error.message)
  }
}

const removeCoupon= async (req,res)=>{
  try {
    const {couponCode}= req.body
    const userId= req.session.user

    const couponData= await Coupon.findOne({couponCode:couponCode})

    if (!couponData) {
      
      return res.status(404).json({ message: "Coupon not found" });
    }

   
   
    res.json({message:"founded"})
  } catch (error) {
    console.log(error.message)
  }
}

module.exports ={
    removeCoupon,
    userReturnProduct,
    verifyCoupon,
    verifyOrder,
    orderCancel,
    loadOrderPage,
    placeOrder


}