const express = require("express");
const mongoose = require("mongoose");
const app = express();
const User = require("../../models/userModel");
const bcrypt = require("bcrypt");
const session = require("express-session");
const Addcategory = require("../../models/categoryModel");
const Products = require("../../models/productModel");
const multer = require("multer");
const path = require("path");
const sharp = require("sharp");
const order = require("../../models/orderModal");
const Coupon = require("../../models/couponModal");
const Offer = require("../../models/offerModal");
const Category = require("../../models/categoryModel");
const Brands = require("../../models/brandsModel");
const puppeteer= require("puppeteer")
const fs = require('fs');
const cropperjs=require('cropperjs');
const { log } = require("console");

const adminid = {
    adminemail: "admin007@gmail.com",
    adminpassword: "12345",
  };
  


const adminLogin = async (req, res) => {
    console.log("admin loginn is calling ===>from admin auth");
    
  try {
    const adminId=adminid
    const email = req.body.email;
    const password = req.body.password;
    
    
    if (adminid.adminemail === email && adminid.adminpassword === password) {
        console.log("11111111111111111111111111111111111");
        
     req.session.admin=adminId
      res.redirect("/admindashboard");
    } else {
      return res.render("admin/adminlogin", { 
        message: "Email or Password were Incorrect",
});
    }
  } catch (error) {
    console.log(error.meaasage);
  }
};


const adminLogout=async (req,res)=>{
    try {
      console.log("coming here")
      req.session.admin=null;
      res.redirect('/adminlogin')
      
    } catch (error) {
      console.log(error.message)
    }
  }


module.exports ={
    adminLogout,
    adminLogin
}  