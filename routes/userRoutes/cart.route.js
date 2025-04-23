
const express = require("express");
const cartController = require("../../controllers/userControllers/cart.controller");
const userAuth = require("../../middleware/userAuth");
const cart_route = express();


cart_route.get('/viewcart',userAuth.isLogin,userAuth.isUserBlock,cartController.loadViewCart)
cart_route.post('/viewcart',userAuth.isLogin,userAuth.isUserBlock,cartController.quantityControll)
cart_route.delete('/viewcart/:id',userAuth.isLogin,userAuth.isUserBlock,cartController.deleteCartProduct)
cart_route.get("/headercarrcount",userAuth.isLogin,userAuth.isUserBlock,cartController.headerCount )


module.exports = cart_route