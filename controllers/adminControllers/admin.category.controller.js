const express = require("express");
const Addcategory = require("../../models/categoryModel");



const addListCategory = async (req, res) => {
  try {
    const category = await Addcategory.findOne();

    res.render("admin/addcategory");
  } catch (error) {
    console.log(error.message);
  }
};


const blockCategory = async (req, res) => {
  try {
    const categoryid = req.params.id;
    const cid = await Addcategory.findById(categoryid);
    if (cid.categorystatus == false) {
      await Addcategory.updateOne({ _id: cid }, { categorystatus: true });
    } else {
      await Addcategory.updateOne({ _id: cid }, { categorystatus: false });
    }

    res.redirect("/admin-category/categorymanagement");
  } catch (error) {
    console.log(error.message);
  }
};

const categoryManage = async (req, res) => {
  try {
      const perPage = 5;
      const page = req.query.page || 1;

      const category = await Addcategory.find()
       .sort({ _id: -1 })
       .skip((perPage * page) - perPage)
       .limit(perPage);
      
      const count = await Addcategory.countDocuments();

      res.render("admin/category", {
          category,
          currentPage: page,
          totalPages: Math.ceil(count / perPage)
      });
  } catch (error) {
      console.log(error.message);
  }
};

const addDetilesCategory = async (req, res) => {
  try {
    const allCategories = await Addcategory.find();

    const cateName = req.body.category;
    const cateDes = req.body.descategory;

    const lowercaseCateName = cateName.toLowerCase();
    const lowercaseCateDes = cateDes.toLowerCase();

    const existingCategoryName = allCategories.find(
      (category) => category.categoryname.toLowerCase() === lowercaseCateName
    );

    const existingCategoryDesc = allCategories.find(
      (category) => category.categorydescription.toLowerCase() === lowercaseCateDes
    );

    if (existingCategoryName) {
      return res.render("admin/addcategory", {
        message: "Category name already exists.",
      });
    }

    if (existingCategoryDesc) {
      return res.render("admin/addcategory", {
        message: "Category description already exists.",
      });
    }

    const category = new Addcategory({
      categoryname: cateName,
      categorydescription: cateDes,
      categorystatus: false,
    });
    await category.save();

    res.render("admin/addcategory", { message: "Category Added Succesfully " });
  } catch (error) {
    console.log(error.message);
  }
};

const editCategory = async (req, res) => {
  try {
    const id = req.params.id;
    const categoryid = await Addcategory.findById({ _id: id });
    if (categoryid) {
      res.render("admin/editcategory", { category: categoryid });
    } else {
      res.redirect("/admin-category/categorymanagement");
    }
  } catch (error) {
    console.log(error.message);
  }
};

const updateCategory = async (req, res) => {
  try {
    const existingCategory = await Addcategory.findOne({
      categoryname: req.body.category,
    });
    const existingDescription = await Addcategory.findOne({
      categorydescription: req.body.descategory,
    });

    if (existingCategory && existingCategory._id != req.body.id) {
      res.redirect(`/admin-category/editCategory/${req.body.id}`);
    } else if (existingDescription && existingDescription._id != req.body.id) {
      res.redirect(`/admin-category/editCategory/${req.body.id}`);
    } else {
      await Addcategory.findByIdAndUpdate(
        { _id: req.body.id },
        {
          $set: {
            categoryname: req.body.category,
            categorydescription: req.body.descategory,
          },
        }
      );
      res.redirect("/admin-category/categorymanagement");
    }
  } catch (error) {
    console.log(error.message);
  }
};


const updateCategoryfetch = async (req, res) => {
  try {
    const catId = req.params.id;
    const { name, des } = req.body;

    const existingCategory = await Addcategory.findOne({ categoryname: name });

    const existingDescription = await Addcategory.findOne({
      categorydescription: des,
    });

    if (existingCategory && existingCategory._id != catId) {
      return res.json({ already: "Name Already in the Category" });
    } else if (existingDescription && existingDescription._id != catId) {
      return res.json({ already: "Descategory Already in the Category" });
    } else {
      await Addcategory.findByIdAndUpdate(
        { _id: catId },
        {
          $set: { categoryname: name, categorydescription: des },
        }
      );
      return res.json({ success: "Category updated successfully" });
    }
  } catch (err) {
    console.log(err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};


module.exports={
    blockCategory,
    categoryManage,
    addDetilesCategory,
    editCategory,
    updateCategory,
    updateCategoryfetch,
    addListCategory
}