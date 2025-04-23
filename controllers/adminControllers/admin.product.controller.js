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


const storage = multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, "public/uploads");
    },
    filename: function (req, file, cb) {
      cb(null, Date.now() + "-" + file.originalname);
    },
  });
  
const upload = multer({ storage: storage }).array("images", 4);
  
app.use(express.static(path.join(__dirname, "public")));


const addProduct = async (req, res) => {
    try {
      const category = await Addcategory.find();
      const brandsData = await Brands.find();
  
      res.render("admin/addproduct", { category,brandsData });
    } catch (error) {
      console.log(error.message);
    }
};

const addNewProduct = async (req, res) => {
    try {
      upload(req, res, async function (err) {
        if (err) {
          console.log("Upload error:", err);
          return res.redirect("/addproduct");
        }
  
        console.log("Files are: ", req.files);
  
        let imageUrls = [];
  
        if (req.files && req.files.length > 0) {
          for (let i = 0; i < req.files.length; i++) {
            const imageBuffer = await sharp(req.files[i].path)
              .resize({ width: 400, height: 500, fit: sharp.fit.cover })
              .toBuffer();
  
            const filename = `cropped_${req.files[i].originalname}`;
            imageUrls.push(filename);
  
            const savePath = path.resolve(__dirname, "../../public/uploads", filename);
  
            await sharp(imageBuffer).toFile(savePath);
          }
        }
  
        const alreadyProduct = await Products.findOne({
          productname: req.body.productName,
        });
  
        if (alreadyProduct) {
          console.log("Product already added");
          return res.redirect("/addproduct");
        }
  
        const product = new Products({
          productname: req.body.productName,
          productprice: req.body.productPrice,
          productquadity: req.body.productQuantity,
          productdescription: req.body.productDescription,
          categoryId: req.body.productCategory,
          productimage: imageUrls,
          isListed: true,
          brand: req.body.productBrand,
        });
  
        console.log(product);
        await product.save();
  
        res.redirect("/admin-product/productlist");
      });
    } catch (err) {
      console.log("Error saving product:", err);
    }
};

const productList = async (req, res) => {
  try {
      const perPage = 10;
      const page = req.query.page || 1;

      const product = await Products.find()
       .sort({ _id: -1 })
       .skip((perPage * page) - perPage)
       .limit(perPage);
      
      const count = await Products.countDocuments();

      res.render("admin/productlist", {
          product,
          currentPage: page,
          totalPages: Math.ceil(count / perPage)
      });
  } catch (error) {
      console.log(error.message);
  }
};

const editProductDetiles = async (req, res) => {
    try {
      const id = req.params.id;
      const product = await Products.findById(id);
      const productlist = await Products.find();
      const category = await Addcategory.find();
      const brand = await Brands.find();
      const categoryid = await Addcategory.findById({ _id: id });
  
      res.render("admin/editproductdetiles", { product, category ,brand});
    } catch (error) {
      console.log(error.message);
    }
};
  
const updateProductsFetch = async (req, res) => {

  
  try {
    const productId = req.params.id;
    const { name, des, price, quandity, category, photos } = req.body;
    const product = await Products.findById(productId);
    const imageCount = product.productimage.length;

    const productData = {};

    if (req.body.name) {
      await Products.findByIdAndUpdate(
        { _id: productId },
        { productname: req.body.name }
      );
    }
    if (req.body.des) {
      await Products.findByIdAndUpdate(
        { _id: productId },
        { productdescription: req.body.des }
      );
    }
    if (req.body.price) {
      await Products.findByIdAndUpdate(
        { _id: productId },
        { productprice: req.body.price }
      );
    }
    if (req.body.quandity) {
      await Products.findByIdAndUpdate(
        { _id: productId },
        { productquadity: req.body.quandity }
      );
    }
    if (req.body.category) {
      await Products.findByIdAndUpdate(
        { _id: productId },
        { categoryId: req.body.category }
      );
    }
    if (req.body.brand) {
      await Products.findByIdAndUpdate(
        { _id: productId },
        { brand: req.body.brand }
      );
    }

    const MAX_IMAGES = 4;
    const remainingImages = MAX_IMAGES - imageCount;

    if (remainingImages > 0) {
      const imageUrls = [];
      for (let i = 0; i < Math.min(req.files.length, remainingImages); i++) {
        const imageBuffer = await sharp(req.files[i].path)
          .resize({ width: 400, height: 500, fit: sharp.fit.cover })
          .toBuffer();
        const filename = `cropped_${req.files[i].originalname}`;
        imageUrls.push(filename);

        await sharp(imageBuffer).toFile(
          path.join(__dirname, `../public/uploads/${filename}`)
        );
      }
      await Products.findByIdAndUpdate(productId, {
        $push: { productimage: { $each: imageUrls } },
      });
    }

    res.redirect("/admin-product/productlist");
  } catch (error) {
    console.log(error.message);
  }
};

const listProduct = async (req, res) => {
  try {
    const id = req.query.id;
    const product = await Products.findById(id);

    if (product.isListed == true) {
      await Products.updateOne({ _id: id }, { isListed: false });
    } else {
      await Products.updateOne({ _id: id }, { isListed: true });
    }
    res.redirect("/admin-product/productlist");
  } catch (error) {
    console.log(error.message);
  }
};

const deleteProductImage = async (req, res) => {
    try {
      const productId = mongoose.Types.ObjectId.createFromHexString(
        req.params.id
      );
      const { name } = req.query;
  
      const result = await Products.findByIdAndUpdate(productId, {
        $pull: { productimage: name },
      });
      res.redirect(`/admin-product/editproductdetiles/${productId}`);
    } catch (error) {
      console.log(error.message);
    }
};
  


  module.exports ={
    addProduct,
    productList,
    editProductDetiles,
    updateProductsFetch,
    listProduct,
    deleteProductImage,
    addNewProduct
  }