const express = require("express");
const userAuthController = require("../../controllers/userControllers/auth.controller");
const userAuth = require("../../middleware/userAuth");
const passport = require("passport");
const userAuth_route = express();



userAuth_route.get("/login",userAuth.isLogout, userAuthController.loadLogin);
userAuth_route.get("/registration",userAuth.isLogout, userAuthController.loadRegister);

userAuth_route.post("/registration",userAuth.isLogout, userAuthController.insertUser);
userAuth_route.post("/otp", userAuthController.otpLogin,userAuth.isUserBlock);
userAuth_route.post("/resendotp", userAuthController.resendOtp);

userAuth_route.post("/userlogin", userAuthController.userLogin); 
userAuth_route.get('/logout',userAuthController.logout)

userAuth_route.get("/google",passport.authenticate("google", { scope: ["profile", "email"] }));

userAuth_route.get("/google/callback",passport.authenticate("google", { failureRedirect: "/failed" }),userAuthController.loadGoogleAuth);



module.exports = userAuth_route