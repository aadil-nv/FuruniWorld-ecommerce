const express = require("express");
const adminUser_route = express();
const adminUserController = require("../../controllers/adminControllers/admin.user.controller");
const adminAuth = require("../../middleware/adminAuth");


adminUser_route.get('/userslist',adminAuth.isLogin,adminUserController.adminUsersList)
adminUser_route.post('/blockuser',adminAuth.isLogin,adminUserController.blockUser)
adminUser_route.post('/usersearch',adminAuth.isLogin,adminUserController.searchUser)



module.exports =adminUser_route