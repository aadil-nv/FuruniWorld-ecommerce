const express = require("express");
const adminUser_route = express();
const bodyParser = require("body-parser");
const adminUserController = require("../../controllers/adminControllers/admin.user.controller");
const multer=require('multer')
const adminAuth = require("../../middleware/adminAuth");


adminUser_route.get('/userslist',adminAuth.isLogin,adminUserController.adminUsersList)
adminUser_route.get('/blockuser',adminAuth.isLogin,adminUserController.blockUser)


module.exports =adminUser_route