const express = require("express");
const queryController = require("../../controllers/userControllers/query.controller");
const userAuth = require("../../middleware/userAuth");
const query_route = express();


query_route.get("/productspopular",userAuth.isLogin,userAuth.isUserBlock, queryController.sortByPopularity);
query_route.get("/productslowtohigh",userAuth.isLogin,userAuth.isUserBlock, queryController.sortByPriceLowToHigh);
query_route.get("/productshightolow",userAuth.isLogin,userAuth.isUserBlock, queryController.sortByPriceHighToLow);
query_route.get("/productsatoz",userAuth.isLogin,userAuth.isUserBlock, queryController.sortByAtoZ);
query_route.get("/productsztoa",userAuth.isLogin,userAuth.isUserBlock, queryController.sortByZtoA);
query_route.post("/search",userAuth.isLogin,userAuth.isUserBlock,queryController.userSearch)
query_route.post("/sendcategoryname",userAuth.isLogin,userAuth.isUserBlock,queryController.searchCategoryName)

module.exports=query_route;