const express = require("express");
const Addcategory = require("../../models/categoryModel");
const StatusCodes = require('../../constants/status.constants');

const addListCategory = async (req, res) => {
  try {
    const category = await Addcategory.findOne();
    res.status(StatusCodes.OK).render("admin/addcategory");
  } catch (error) {
    console.log("Error rendering add category page:", error.message);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).send("Internal Server Error");
  }
};

const blockCategory = async (req, res) => {
  try {
    const { categoryId } = req.body; // Changed from categoryid to categoryId for consistency
    
    if (!categoryId) {
      return res.status(400).json({
        success: false,
        message: 'Category ID is required'
      });
    }

    const category = await Addcategory.findById({_id:categoryId});
    
    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }

    const newStatus = !category.categorystatus;
    
    await Addcategory.updateOne(
      { _id: categoryId }, 
      { categorystatus: newStatus }
    );

    res.status(200).json({
      success: true,
      categorystatus: newStatus,
      message: newStatus ? 'Category blocked successfully' : 'Category unblocked successfully'
    });

  } catch (error) {
    console.log("Error blocking/unblocking category:", error.message);
    
    res.status(500).json({
      success: false,
      message: 'Internal Server Error'
    });
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

    res.status(StatusCodes.OK).render("admin/category", {
      category,
      currentPage: page,
      totalPages: Math.ceil(count / perPage)
    });
  } catch (error) {
    console.log("Error managing categories:", error.message);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).send("Internal Server Error");
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
      return res.status(StatusCodes.CONFLICT).render("admin/addcategory", {
        message: "Category name already exists.",
      });
    }

    if (existingCategoryDesc) {
      return res.status(StatusCodes.CONFLICT).render("admin/addcategory", {
        message: "Category description already exists.",
      });
    }

    const category = new Addcategory({
      categoryname: cateName,
      categorydescription: cateDes,
      categorystatus: false,
    });
    await category.save();

    res.status(StatusCodes.CREATED).render("admin/addcategory", { message: "Category added successfully." });
  } catch (error) {
    console.log("Error adding category details:", error.message);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).send("Internal Server Error");
  }
};

const editCategory = async (req, res) => {
  try {
    const id = req.params.id;
    const categoryid = await Addcategory.findById({ _id: id });
    if (categoryid) {
      res.status(StatusCodes.OK).render("admin/editcategory", { category: categoryid });
    } else {
      res.status(StatusCodes.NOT_FOUND).redirect("/admin-category/categorymanagement");
    }
  } catch (error) {
    console.log("Error loading category for editing:", error.message);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).send("Internal Server Error");
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
      res.status(StatusCodes.CONFLICT).redirect(`/admin-category/editCategory/${req.body.id}`);
    } else if (existingDescription && existingDescription._id != req.body.id) {
      res.status(StatusCodes.CONFLICT).redirect(`/admin-category/editCategory/${req.body.id}`);
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
      res.status(StatusCodes.OK).redirect("/admin-category/categorymanagement");
    }
  } catch (error) {
    console.log("Error updating category:", error.message);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).send("Internal Server Error");
  }
};

const updateCategoryfetch = async (req, res) => {
  try {
    const catId = req.params.id;
    const { name, des } = req.body;

    const existingCategory = await Addcategory.findOne({ categoryname: name });
    const existingDescription = await Addcategory.findOne({ categorydescription: des });

    if (existingCategory && existingCategory._id != catId) {
      return res.status(StatusCodes.CONFLICT).json({ already: "Category name already exists." });
    } else if (existingDescription && existingDescription._id != catId) {
      return res.status(StatusCodes.CONFLICT).json({ already: "Category description already exists." });
    } else {
      await Addcategory.findByIdAndUpdate(
        { _id: catId },
        {
          $set: { categoryname: name, categorydescription: des },
        }
      );
      return res.status(StatusCodes.OK).json({ success: "Category updated successfully." });
    }
  } catch (err) {
    console.log("Error updating category fetch:", err.message);
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: "Internal Server Error" });
  }
};

module.exports = {
  blockCategory,
  categoryManage,
  addDetilesCategory,
  editCategory,
  updateCategory,
  updateCategoryfetch,
  addListCategory
};
