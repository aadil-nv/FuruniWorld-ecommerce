const User = require("../../models/userModel");
const Otp = require("../../models/otp");
const bcrypt = require("bcrypt");
const nodemailer = require("nodemailer");
const Products = require("../../models/productModel");
const securedPassword = require('../../utils/hashPassword')
const generateOTP=require("../../utils/genarateOtp")
const generateReferralCode =require("../../utils/generateReferralCode")

require("dotenv").config();


let userData;


 const loadRegister = async (req, res) => {
  try {
    res.render("user/registration");
  } catch (erorr) {
    console.log(erorr.message);
  }
};


 const insertUser = async (req, res) => {
  console.log("calling insert user frum auth controller=====>");
  
   try {
     const referalId=generateReferralCode(7)
 
     const checkemail = await User.findOne({ email: req.body.email });
     if (checkemail) {
       return res.render("user/registration", {
         message: "Email already exist",
       });
     }
 
     const spassword = await securedPassword(req.body.password);
 
     const email = req.body.email;
     const emailRegex = /^[A-Za-z0-9.%+-]+@gmail\.com$/;
     if (!emailRegex.test(email)) {
       res.render("user/registration", { message: "Invalid Email Provided" });
     }
 
     const name = req.body.name;
     const nameRegex = /^[a-zA-Z]+(?: [a-zA-Z]+)*$/;
 
     if (!nameRegex.test(name.trim())) {
       res.render("user/registration", { message: "Invalid Name Provided" });
     }
 
     const mobileRegex = /^\d{10}$/;
     if (!mobileRegex.test(req.body.mno)) {
       return res.render("user/registration", {
         message: "Invalid Mobile Number Povided",
       });
     }
 
     const user = new User({
       name: req.body.name,
       email: req.body.email,
       mobile: req.body.mno,
       password: spassword,
       is_admin: 0,
       is_blocked: false,
       referalId:referalId,
       wallet:0,
       walletHistory:[],
       referdId:req.body.referdid
     });
 
     userData = user;
 
     if (userData) {
       const otp = generateOTP();
 
       const userotp = new Otp({
         otp: otp,
         email: req.body.email,
       });
       await userotp.save();
 
       verifyEmail(name, email, otp);
 
       return res.render("user/otp");
     } else {
       res.render("registration", {
         message: "Your Registration has been Failed ",
       });
     }
   } catch (erorr) {
     console.log(erorr.message);
   }
 };


 const verifyEmail = async (name, email, otp) => {
  try {
    const transport = nodemailer.createTransport({
      service: "gmail",

      auth: {
        user: "adilev2000@gmail.com",
        pass: "zufu zbyh zeac zptj",
      },
    });
    const mailoption = {
      from: "adilev2000@gmail.com",
      to: email,
      subject: "for verification mail",
      html: `<h1>hi ${name} this is OTP form Ecommerce-Furniture <a>${otp}</a></h1>`,
    };
    transport.sendMail(mailoption, (err, info) => {
      if (err) {
        console.log(err.message);
      } else {
        console.log(`Email has been sent: ${info.messageId}`);
        console.log(`Preview URL: ${nodemailer.getTestMessageUrl(info)}`);
      }
    });
  } catch (error) {
    console.log(error.message);
  }
};


 const otpLogin = async (req, res) => {
  try {
    const storedEmail = await Otp.findOne({ Otps: req.body.otp }).sort({
      createdAt: -1,
    });
    const storedOtp = storedEmail.otp;
    const { n1, n2, n3, n4 } = req.body;
    const userOtp = `${n1}${n2}${n3}${n4}`;

    if (storedOtp == userOtp) {
      await userData.save();
      await User.findOneAndUpdate(
        { email: userData.email },
        { is_verified: true }
      );
      return res.render("user/login", {
        message: "Successfull Registerd Now Login",
      });
    } else {
      return res.render("user/otp", { message: "wrong Otp" });
    }
  } catch (error) {
    console.log(error.message);
  }
};


 const loadLogin = async (req, res) => {
  console.log("calling ================");
  
  try {
    res.render("user/login");
  } catch (erorr) {
    console.log(erorr.message);
  }
};


 const userLogin = async (req, res) => {
  
  try {
    const userData = await User.findOne({ email: req.body.email });

    if (!userData) {
      res.render("user/login", { message: "Not a user" });
    }

    const block = userData.is_blocked;

    const ProductData = await Products.find();

    if (userData) {
      const passwordMatch = await bcrypt.compare(
        req.body.password,
        userData.password
      );

      if (passwordMatch && !block) {
        
        req.session.user = userData._id;
        res.redirect("/userhome");
      } else if (block) {
        res.render("user/login", { message: "Your Account has been blocked" });
      } else {
        res.render("user/login", { message: "Incorrect Mail and Password" });
      }
    } else {
      res.render("user/login", { message: "Your Account has been blocked" });
    }
  } catch (error) {
    console.log(error.message);
  }
};


 const logout = async (req, res) => {
  try {
    req.session.destroy((err) => {
      if (err) {
        cosole.log("session is not destroyed");
      } else {
        res.redirect("/");
      }
    });
  } catch (error) {
    console.log(error.message);
  }
};


 const resendOtp = async (req, res) => {
  try {
    const newotp = generateOTP();

    verifyEmail(userData.name, userData.email, newotp);
    await Otp.updateOne({ email: userData.email }, { otp: newotp });

    res.render("user/otp");
  } catch (error) {
    console.log(error.message);
  }
};  

 const loadGoogleAuth = async (req, res) => {
  try {
    const ProductData = await Products.find();
    const gUser = req.user;

    res.render("user/index", { ProductData });
  } catch (error) {
    console.log(error.message);
  }
};



module.exports = {
  loadRegister,
  insertUser,
  otpLogin,
  loadLogin,
  userLogin,
  logout,
  resendOtp,
  loadGoogleAuth,
};