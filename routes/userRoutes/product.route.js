const express = require("express");
const productController = require("../../controllers/userControllers/product.controller");
const userAuth = require("../../middleware/userAuth");
const product_route = express();


product_route.get("/producttab/:id",userAuth.isLogin,userAuth.isUserBlock, productController.loadProductTab);
product_route.post('/producttab/:id',userAuth.isLogin,userAuth.isUserBlock,productController.addProductInCart)

product_route.get('/checkoutpage',userAuth.isLogin,userAuth.isUserBlock,productController.loadtCheckoutPage)
product_route.post('/checkoutpage/:id',userAuth.isLogin,userAuth.isUserBlock,productController.editUseraddressInCheckout)
product_route.post('/checkoutpage',userAuth.isLogin,userAuth.isUserBlock,productController.updatecartAddress)
product_route.post('/checkoutpageone',userAuth.isLogin,userAuth.isUserBlock,productController.addCheckoutAddress)
product_route.get("/checkout-validation",userAuth.isLogin,userAuth.isUserBlock,productController.proceedToCheckout )






module.exports=product_route