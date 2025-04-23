const express = require("express");
const adminProduct_route = express();
const bodyParser = require("body-parser");
const adminProductController = require("../../controllers/adminControllers/admin.product.controller");
const adminAuth = require("../../middleware/adminAuth");
const upload = require("../../middleware/multer"); 

adminProduct_route.use(bodyParser.json());
adminProduct_route.use(bodyParser.urlencoded({ extended: true }));


adminProduct_route.get('/addproduct',adminAuth.isLogin,adminProductController.addProduct)
adminProduct_route.get('/productlist',adminAuth.isLogin,adminProductController.productList)
adminProduct_route.get('/editproductdetiles/:id',adminAuth.isLogin,adminProductController.editProductDetiles)
adminProduct_route.post('/addproduct',adminAuth.isLogin,adminProductController.addNewProduct)
adminProduct_route.post('/editproductdetilesfetch/:id',adminAuth.isLogin,upload.array('photos'),adminProductController.updateProductsFetch)
adminProduct_route.get('/listProduct',adminAuth.isLogin,adminProductController.listProduct) 
adminProduct_route.get('/editproductdetilesfetch/:id',adminAuth.isLogin,adminProductController.deleteProductImage)

module.exports =adminProduct_route
