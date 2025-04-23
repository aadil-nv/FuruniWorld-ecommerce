const express = require("express");
const user_route = express();
const bodyParser = require("body-parser");
const usercontroller = require("../../controllers/userControllers/user.controller");
const userAuth = require("../../middleware/userAuth");

user_route.use(bodyParser.json());
user_route.use(bodyParser.urlencoded({ extended: true }));

user_route.get("/", userAuth.isLogout,userAuth.isUserBlock,usercontroller.home);
user_route.get("/userhome", userAuth.isLogin,userAuth.isUserBlock,usercontroller.home);
user_route.get("/userhome",userAuth.isLogin,userAuth.isUserBlock, usercontroller.backToUserHome);  


user_route.get("/shoppage",userAuth.isLogin, userAuth.isUserBlock,usercontroller.loadShopPage);
user_route.get("/aboutpage",userAuth.isLogin,userAuth.isUserBlock, usercontroller.loadAboutPage);
user_route.get("/contactpage",userAuth.isLogin,userAuth.isUserBlock, usercontroller.loadContactPage);


user_route.get("/userprofile",userAuth.isLogin,userAuth.isUserBlock, usercontroller.loadUserProfile);
user_route.get('/edituserdetiles',userAuth.isLogin,userAuth.isUserBlock,usercontroller.editUseprofile)
user_route.post('/edituserdetiles/:id',userAuth.isLogin,userAuth.isUserBlock,usercontroller.updateUserProfile)
user_route.post('/userprofile/:id',userAuth.isLogin,userAuth.isUserBlock,usercontroller.updateUserPassword)
user_route.get('/adduseraddress/:id',userAuth.isLogin,userAuth.isUserBlock,usercontroller.loadAddressPage)
user_route.post('/adduseraddress',userAuth.isLogin,userAuth.isUserBlock,usercontroller.addUserAddress)
user_route.get('/edituseraddress/:id',userAuth.isLogin,userAuth.isUserBlock,usercontroller.loadEditUser)
user_route.post('/edituseraddress/:id',userAuth.isLogin,userAuth.isUserBlock,usercontroller.updateUserAddress)
user_route.delete('/deleteaddress/:id',userAuth.isLogin,userAuth.isUserBlock,usercontroller.deleteUseraddress)




module.exports = user_route;
