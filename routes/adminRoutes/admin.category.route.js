const express = require("express");
const adminCategory_route = express();
const adminCategoryController = require("../../controllers/adminControllers/admin.category.controller");
const adminAuth = require("../../middleware/adminAuth");


adminCategory_route.get('/addcategory',adminAuth.isLogin,adminCategoryController.addListCategory)
adminCategory_route.get('/adminBlockcategory/:id',adminAuth.isLogin,adminCategoryController.blockCategory);
adminCategory_route.get('/categorymanagement',adminAuth.isLogin,adminCategoryController.categoryManage)
adminCategory_route.post('/addcategory',adminAuth.isLogin,adminCategoryController.addDetilesCategory)
adminCategory_route.get('/editCategory/:id',adminAuth.isLogin,adminCategoryController.editCategory)
adminCategory_route.post("/editCategory",adminAuth.isLogin, adminCategoryController.updateCategory);
adminCategory_route.post('/editcategoryfetch/:id',adminAuth.isLogin,adminCategoryController.updateCategoryfetch)


module.exports = adminCategory_route