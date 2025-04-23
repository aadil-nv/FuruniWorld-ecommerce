const express = require("express");
const wishListController = require("../../controllers/userControllers/wishlist.controller");
const userAuth = require("../../middleware/userAuth");
const wishList_route = express();


wishList_route.get("/wishlist",userAuth.isLogin,userAuth.isUserBlock,wishListController.loadWishliist)
wishList_route.post("/wishlist",userAuth.isLogin,userAuth.isUserBlock,wishListController.addProductInWishlist)
wishList_route.post("/wishlistone",userAuth.isLogin,userAuth.isUserBlock,wishListController.removeWishlistProduct)




module.exports =wishList_route










