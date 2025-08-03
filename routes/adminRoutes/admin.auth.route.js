const express = require("express");
const adminAuth_route = express();
const adminAuthController = require("../../controllers/adminControllers/admin.auth.controller");
const adminAuth = require("../../middleware/adminAuth");



adminAuth_route.post('/adminlogin', adminAuth.isLogout, adminAuthController.adminLogin)
adminAuth_route.post("/adminlogout", adminAuth.isLogin, adminAuthController.adminLogout)




module.exports = adminAuth_route