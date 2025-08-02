const express = require("express");
const orderController = require("../../controllers/userControllers/order.controller");
const userAuth = require("../../middleware/userAuth");
const order_route = express();




order_route.post('/orderpage',userAuth.isLogin,userAuth.isUserBlock,orderController.placeOrder)
order_route.get('/orders/:id',userAuth.isLogin,userAuth.isUserBlock,orderController.loadOrderPage)
order_route.post('/ordersone',userAuth.isLogin,userAuth.isUserBlock,orderController.orderCancel)
order_route.post("/verifyorder",userAuth.isLogin,userAuth.isUserBlock,orderController.verifyOrder)
order_route.post("/verifycoupon",userAuth.isLogin,userAuth.isUserBlock,orderController.verifyCoupon)
order_route.post("/productreturn",userAuth.isLogin,userAuth.isUserBlock,orderController.userReturnProduct)
order_route.post("/removecoupon",userAuth.isLogin,userAuth.isUserBlock,orderController.removeCoupon)
order_route.post("/retryPayment",userAuth.isLogin,userAuth.isUserBlock,orderController.retryPayment)
order_route.post("/retrypaymentverification",userAuth.isLogin,userAuth.isUserBlock,orderController.retryPaymentVerification)


module.exports=order_route