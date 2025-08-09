const express = require("express");
const session = require("express-session");
const Products = require("../../models/productModel");
const sharp = require("sharp");
const order = require("../../models/orderModal");
const Coupon = require("../../models/couponModal");
const Offer = require("../../models/offerModal");
const Category = require("../../models/categoryModel");
const Brands = require("../../models/brandsModel");
const puppeteer = require("puppeteer");
const StatusCodes = require("../../constants/status.constants");
const User = require("../../models/userModel");
const { log10 } = require("chart.js/helpers");

const loadAdminLogin = async (req, res) => {
  try {
    res.status(StatusCodes.OK).render("admin/adminlogin");
  } catch (error) {
    console.error("Error from loadAdminLogin", error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).send("Internal Server Error");
  }
};

const adminDashboard = async (req, res) => {
  try {
    // Fetch all orders
    const salesReport = await order
      .find()
      .populate("orderedItem.productId")
      .populate("deliveryAddress")
      .populate("userId")
      .sort({ _id: 1 });

    // Dashboard counts
    const productCount = await Products.countDocuments();
    const categoryCount = await Category.countDocuments();

    // === Totals (same calculation logic as totalSalesReport) ===
    let totalSalesAmount = 0;
    let totalCouponDeduction = 0;
    let overAllOrderAmount = 0;
    let salesCount = 0;
    let overallRevenue = 0;

    salesReport.forEach((order) => {
      const isValidPayment =
        order.paymentStatus === "Payment Successful" &&
        (order.paymentMethod === "RazorPay" || order.paymentMethod === "Wallet");

      let orderTotal = 0;

      order.orderedItem.forEach((item) => {
        if (item.productStatus !== "Order Cancelled") {
          orderTotal += item.totalProductAmount;
          overAllOrderAmount += item.totalProductAmount;
        }
      });

      totalSalesAmount += orderTotal;

      if (isValidPayment) {
        overallRevenue += orderTotal;
      }

      totalCouponDeduction += order.couponDeduction;
      salesCount++;
    });

    // === Monthly earnings ===
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth() + 1;
    const currentYear = currentDate.getFullYear();

    const salesReport2 = await order
      .find({
        paymentStatus: "Payment Successful",
        $expr: {
          $and: [
            { $eq: [{ $month: "$shippingDate" }, currentMonth] },
            { $eq: [{ $year: "$shippingDate" }, currentYear] },
          ],
        },
      })
      .populate("orderedItem.productId")
      .populate("deliveryAddress")
      .populate("userId")
      .sort({ _id: 1 });

    let monthlyEarning = 0;
    salesReport2.forEach((order) => {
      order.orderedItem.forEach((item) => {
        if (item.productStatus !== "Order Cancelled") {
          monthlyEarning += item.totalProductAmount;
        }
      });
    });

    // === Most bought products ===
    const mostBoughtProducts = await order.aggregate([
      { $unwind: "$orderedItem" },
      {
        $group: {
          _id: "$orderedItem.productId",
          totalQuantity: { $sum: "$orderedItem.quantity" },
        },
      },
      { $sort: { totalQuantity: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: "products",
          localField: "_id",
          foreignField: "_id",
          as: "productDetails",
        },
      },
      { $unwind: "$productDetails" },
      {
        $project: {
          _id: "$productDetails._id",
          productName: "$productDetails.productname",
          totalQuantity: 1,
        },
      },
    ]);

    // === Most bought categories ===
    const mostBoughtCategories = await order.aggregate([
      { $unwind: "$orderedItem" },
      {
        $lookup: {
          from: "products",
          localField: "orderedItem.productId",
          foreignField: "_id",
          as: "productDetails",
        },
      },
      { $unwind: "$productDetails" },
      {
        $group: {
          _id: "$productDetails.categoryId",
          totalQuantity: { $sum: "$orderedItem.quantity" },
        },
      },
      { $sort: { totalQuantity: -1 } },
      { $limit: 10 },
    ]);

    // === Most bought brands ===
    const mostBoughtBrands = await order.aggregate([
      { $unwind: "$orderedItem" },
      {
        $lookup: {
          from: "products",
          localField: "orderedItem.productId",
          foreignField: "_id",
          as: "productDetails",
        },
      },
      { $unwind: "$productDetails" },
      {
        $group: {
          _id: "$productDetails.brand",
          totalQuantity: { $sum: "$orderedItem.quantity" },
        },
      },
      { $sort: { totalQuantity: -1 } },
      { $limit: 10 },
    ]);

    return res.render("admin/admindashboard", {
      salesReport,
      totalSalesAmount,
      totalCouponDeduction,
      salesCount,
      overAllOrderAmount,
      productCount,
      categoryCount,
      monthlyEarning,
      mostBoughtProducts,
      mostBoughtCategories,
      mostBoughtBrands,
      overallRevenue,
    });
  } catch (error) {
    console.log(error.message);
  }
};


const adminOrdersList = async (req, res) => {
  try {
    const perPage = 10;
    const page = req.query.page || 1;

    const orderData = await order
      .find()
      .populate("orderedItem.productId")
      .populate("deliveryAddress")
      .populate("userId")
      .sort({ _id: -1 })
      .skip((page - 1) * perPage)
      .limit(perPage);

    const count = await order.countDocuments();

    res.status(StatusCodes.OK).render("admin/orderlist", {
      orderData,
      currentPage: page,
      totalPages: Math.ceil(count / perPage),
    });
  } catch (error) {
    console.log(error.message);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).send("Internal Server Error");
  }
};

const adminOrderDetiles = async (req, res) => {
  try {
    const orderId = req.params.id;

    let orderData = await order
      .findById({ _id: orderId })
      .populate({
        path: "orderedItem.productId",
        populate: { path: "offerId" } // Populate product-wise offer if any
      })
      .populate("deliveryAddress")
      .populate("userId");

    // Loop through each product to check offers
    for (let item of orderData.orderedItem) {
      console.log("item", item);
      
      const product = item.productId;
      let offer = null;

      // 1️⃣ Product-wise offer
      if (product.offerId) {
        
        offer = product.offerId;
      } else {
        // 2️⃣ Category-wise offer
        offer = await Offer.findOne({
          offerType: "category",
          offerTypeName: product.categoryId,
          status: "active",
          expiryDate: { $gte: new Date() }
        });
      }

      // 3️⃣ Calculate deduction if offer exists
      if (offer) {
        const discount = (product.productprice * offer.percentage) / 100;
        const offerPrice = product.productprice - discount;

        // Attach extra info to send to view
        item.offerDetails = {
          offerName: offer.offerName,
          percentage: offer.percentage,
          discountAmount: discount,
          finalPrice: offerPrice
        };
      } else {
        item.offerDetails = null;
      }
    }

    

    res.status(StatusCodes.OK).render("admin/orderdetiles", { orderData });
  } catch (error) {
    console.log(error.message);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).send("Internal Server Error");
  }
};


const adminChangeOrderStatus = async (req, res) => {
  try {
    const { selectedStatus, productId, orderId, userId } = req.body;

    console.log("req.body-----------------adminChangeOrderStatus---------------", req.body);

    if (selectedStatus === "null") {
      return res.status(400).json({ message: "selectedStatus is null" });
    }

    // Get the order and find the matching product amount
    const orderData = await order.findById(orderId)
      .populate("orderedItem.productId")
      .populate("deliveryAddress")
      .populate("userId");

    if (!orderData) {
      return res.status(StatusCodes.NOT_FOUND).json({ message: "Order not found" });
    }

    const productItem = orderData.orderedItem.find(
      item => item.productId._id.toString() === productId
    );
    console.log("productItem", productItem);
    

    if (!productItem) {
      return res.status(StatusCodes.NOT_FOUND).json({ message: "Product not found in order" });
    }

    const totalProductAmount = productItem.totalProductAmount; // 🔹 Use DB value

    // Update product status and reduce amount if cancelled
    const updatedOrder = await order.findOneAndUpdate(
      { _id: orderId, "orderedItem.productId": productId },
      {
        $set: { "orderedItem.$.productStatus": selectedStatus },
        ...(selectedStatus.toLowerCase() === "order cancelled" && {
          $inc: { orderAmount: -totalProductAmount }
        })
      },
      { new: true }
    )
    .populate("orderedItem.productId")
    .populate("deliveryAddress")
    .populate("userId");

    // Refund if cancelled
    if (selectedStatus.toLowerCase() === "order cancelled" && updatedOrder.paymentMethod !== "Cash On Delivery") {
      await User.findByIdAndUpdate(
        userId,
        {
          $inc: { wallet: totalProductAmount },
          $push: {
            walletHistory: {
              amount: totalProductAmount,
              description: `Refund of ORDERID:${updatedOrder.orderId}`,
              date: new Date(),
              status: "credit",
            }
          }
        },
        { new: true }
      );
    }

    res.status(StatusCodes.OK).json({
      message: "Order status updated successfully",
      updatedOrder
    });

  } catch (error) {
    console.log(error.message);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).send("Internal Server Error");
  }
};



const searchCoupon = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1; // Current page
    const itemsPerPage = parseInt(req.query.items) || 5; // Items per page
    const { search } = req.query; // Search term from query string

    console.log("Search term:", search);

    // Build search filter
    const query = search
      ? {
          $or: [
            { couponName: { $regex: search, $options: "i" } }, // Case-insensitive
            { couponCode: { $regex: search, $options: "i" } }
          ]
        }
      : {};

    const skip = (page - 1) * itemsPerPage;

    // Count total matching coupons
    const totalCoupons = await Coupon.countDocuments(query);
    const totalPages = Math.ceil(totalCoupons / itemsPerPage);

    // Fetch coupons with filter and pagination
    const couponData = await Coupon.find(query)
      .sort({ _id: -1 })
      .skip(skip)
      .limit(itemsPerPage);

    res.status(StatusCodes.OK).render("admin/couponlist", {
      couponData,
      currentPage: page,
      totalPages,
      totalCoupons,
      itemsPerPage,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
      nextPage: page + 1,
      prevPage: page - 1,
      searchQuery: search || ""
    });
  } catch (error) {
    console.log(error.message);
    res
      .status(StatusCodes.INTERNAL_SERVER_ERROR)
      .send("Internal Server Error");
  }
};

const admincouponlist = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const itemsPerPage = parseInt(req.query.items) || 5; // Default to 10 items per page
    
    const skip = (page - 1) * itemsPerPage;
    
    const totalCoupons = await Coupon.countDocuments();
    
    const totalPages = Math.ceil(totalCoupons / itemsPerPage);
    
    const couponData = await Coupon.find()
      .sort({ _id: -1 })
      .skip(skip)
      .limit(itemsPerPage);
    
    res.status(StatusCodes.OK).render("admin/couponlist", {
      couponData,
      currentPage: page,
      totalPages,
      totalCoupons,
      itemsPerPage,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
      nextPage: page + 1,
      prevPage: page - 1
    });
  } catch (error) {
    console.log(error.message);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).send("Internal Server Error");
  }
};



const admincouponmanagement = async (req, res) => {
  try {
    res.status(StatusCodes.OK).render("admin/createcoupon");
  } catch (error) {
    console.log(error.message);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).send("Internal Server Error");
  }
};

const addNewCoupon = async (req, res) => {
  try {
    const { data } = req.body;

    if (!data) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid request data" });
    }

    const couponname = data.couponName;
    const couponcode = data.couponCode;

    const existingCouponName = await Coupon.findOne({ couponName: couponname });
    const existingCouponCode = await Coupon.findOne({ couponCode: couponcode });

    if (existingCouponName) {
      return res
        .status(409)
        .json({ success: false, message: "Coupon name already exists" });
    }

    if (existingCouponCode) {
      return res
        .status(409)
        .json({ success: false, message: "Coupon code already exists" });
    }

    const couponData = new Coupon({
      couponName: data.couponName,
      couponCode: data.couponCode,
      discountAmount: data.couponDiscount,
      minAmount: data.couponMinAmount,
      couponDescription: data.couponDescription,
      expiryDate: data.couponExpire,
      status: true,
    });

    await couponData.save();

    return res
      .status(201)
      .json({ success: true, message: "Coupon created successfully" });
  } catch (error) {
    console.error("Error adding coupon:", error.message);
    return res
      .status(500)
      .json({ success: false, message: "Internal Server Error" });
  }
};

const deleteCoupon = async (req, res) => {
  try {
    const { data } = req.body;

    if (!data) {
      return res
        .status(StatusCodes.BAD_REQUEST)
        .json({
          success: false,
          message: "Delete failed. No coupon ID provided.",
        });
    }

    const deleted = await Coupon.findByIdAndDelete({ _id: data });

    if (!deleted) {
      return res
        .status(StatusCodes.NOT_FOUND)
        .json({ success: false, message: "Coupon not found." });
    }

    return res
      .status(StatusCodes.OK)
      .json({ success: true, message: "Delete successful." });
  } catch (error) {
    console.error("Delete coupon error:", error.message);
    return res
      .status(StatusCodes.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: "Internal server error." });
  }
};

const adminOfferList = async (req, res) => {
  try {
    const perPage = 5;
    const page = parseInt(req.query.page) || 1;

    const offerData = await Offer.find()
      .skip((page - 1) * perPage)
      .limit(perPage);

    const count = await Offer.countDocuments();

    return res.status(StatusCodes.OK).render("admin/offerlist", {
      offerData,
      currentPage: page,
      totalPages: Math.ceil(count / perPage),
    });
  } catch (error) {
    console.error("Error in adminOfferList:", error.message);
    return res
      .status(StatusCodes.INTERNAL_SERVER_ERROR)
      .render("admin/500", { message: "Internal Server Error" });
  }
};

const createCoupon = async (req, res) => {
  try {
    const categoryData = await Category.find();
    const productData = await Products.find();

    return res
      .status(StatusCodes.OK)
      .render("admin/createoffer", { categoryData, productData });
  } catch (error) {
    console.error("Error loading create offer page:", error.message);
    return res
      .status(StatusCodes.INTERNAL_SERVER_ERROR)
      .render("admin/500", { message: "Internal Server Error" });
  }
};

const addNewOffer = async (req, res) => {
  try {
    const { data } = req.body;

    if (!data) {
      return res
        .status(StatusCodes.BAD_REQUEST)
        .json({ message: "Invalid input data" });
    }

    const newOffer = new Offer({
      offerName: data.offerName,
      description: data.offerDescription,
      percentage: data.offerPercentage,
      expiryDate: data.offerExpiryDate,
      status: data.offerStatus,
      offerType: data.offerType,
      offerTypeName: data.offerItem,
    });

    await newOffer.save();
    const newOfferData = newOffer;

    // Apply offer based on type
    if (newOffer.offerType === "category") {
      const offerCategoryData = await Products.find({
        categoryId: data.offerItem,
      }).populate("offerId");

      const maxExistingPercentage = Math.max(
        ...offerCategoryData.map((product) => product.offerId?.percentage || 0)
      );

      if (
        newOfferData.percentage > maxExistingPercentage ||
        maxExistingPercentage === undefined
      ) {
        await Products.updateMany(
          { categoryId: newOfferData.offerTypeName },
          { $set: { offerId: newOfferData } }
        );
      }
    } else if (newOffer.offerType === "product") {
      const offerProductData = await Products.findOne({
        productname: data.offerItem,
      }).populate("offerId");
      const existingPercentage = offerProductData?.offerId?.percentage || 0;

      if (newOfferData.percentage > existingPercentage) {
        await Products.findByIdAndUpdate(offerProductData._id, {
          $set: { offerId: newOfferData },
        });
      }
    }

    return res
      .status(StatusCodes.CREATED)
      .json({ message: "Offer added successfully" });
  } catch (error) {
    console.error("Error adding new offer:", error.message);
    return res
      .status(StatusCodes.INTERNAL_SERVER_ERROR)
      .json({ message: "Failed to add offer. Internal Server Error." });
  }
};


const selectOfferType = async (req, res) => {
  try {
    const { selectedValue } = req.body;

    if (!selectedValue) {
      return res
        .status(StatusCodes.BAD_REQUEST)
        .json({ message: "Missing offer type selection" });
    }

    if (selectedValue === "category") {
      const categoryData = await Category.find();
      return res.status(StatusCodes.OK).json({ categoryData });
    } else {
      const productData = await Products.find();
      return res.status(StatusCodes.OK).json({ productData });
    }
  } catch (error) {
    console.error("Error in selectOfferType:", error.message);
    return res
      .status(StatusCodes.INTERNAL_SERVER_ERROR)
      .json({ message: "Server error while fetching offer type data" });
  }
};

const totalSalesReport = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const perPage = 10;
    const skip = (page - 1) * perPage;

    // Get paginated data for table display
    const salesReport = await order
      .find()
      .populate("orderedItem.productId")
      .populate("deliveryAddress")
      .populate("userId")
      .sort({ _id: -1 })
      .skip(skip)
      .limit(perPage);

    // Get ALL data for statistics calculation (no pagination)
    const allSalesData = await order
      .find()
      .populate("orderedItem.productId")
      .populate("deliveryAddress")
      .populate("userId")
      .sort({ _id: -1 });

    let totalSalesAmount = 0;
    let totalCouponDeduction = 0;
    let overAllOrderAmount = 0;
    let salesCount = 0;
    let overallRevenue = 0; 

    // Calculate statistics from ALL data, not just current page
    allSalesData.forEach((order) => {
      const isValidPayment =
        order.paymentStatus === "Payment Successful" &&
        (order.paymentMethod === "RazorPay" || order.paymentMethod === "Wallet");

      let orderTotal = 0;

      order.orderedItem.forEach((item) => {
        if (item.productStatus !== "Order Cancelled") {
          orderTotal += item.totalProductAmount;
          overAllOrderAmount += item.totalProductAmount;
        }
      });

      totalSalesAmount += orderTotal;

      if (isValidPayment) {
        overallRevenue += orderTotal;
      }

      totalCouponDeduction += order.couponDeduction;
      salesCount++;
    });

    const totalSalesCount = await order.countDocuments();
    const totalPages = Math.ceil(totalSalesCount / perPage);

    
    
    res.status(StatusCodes.OK).render("admin/salesreport", {
      salesReport, // Only paginated data for table
      totalSalesAmount, // Calculated from all data
      totalCouponDeduction, // Calculated from all data
      salesCount, // Count of all data
      overAllOrderAmount, // Calculated from all data
      totalPages,
      currentPage: page,
      overallRevenue, // Calculated from all data
      totalSalesCount // Total count
    });
  } catch (error) {
    console.error("Error generating sales report:", error.message);
    res
      .status(StatusCodes.INTERNAL_SERVER_ERROR)
      .json({ message: "Something went wrong" });
  }
};

const salesSearch = async (req, res) => {
  console.log("calling sales search is ===>=====>");
  
  try {
    const { searchQuery } = req.query; // Get search query from request
    console.log("searchQuery", searchQuery);
    
    const page = parseInt(req.query.page) || 1;
    const perPage = 10;
    const skip = (page - 1) * perPage;

    // Build search criteria
    let searchCriteria = {};
    
    if (searchQuery) {
      // Search can be by order ID, billing name, or payment method
      searchCriteria = {
        $or: [
          { orderId: { $regex: searchQuery, $options: 'i' } },
          { 'deliveryAddress.name': { $regex: searchQuery, $options: 'i' } },
          { paymentMethod: { $regex: searchQuery, $options: 'i' } }
        ]
      };
    }

    // Get paginated search results for table display
    const searchResults = await order
      .find(searchCriteria)
      .populate("orderedItem.productId")
      .populate("deliveryAddress")
      .populate("userId")
      .sort({ _id: -1 })
      .skip(skip)
      .limit(perPage);

    // Get ALL search results for statistics calculation (no pagination)
    const allSearchResults = await order
      .find(searchCriteria)
      .populate("orderedItem.productId")
      .populate("deliveryAddress")
      .populate("userId")
      .sort({ _id: -1 });

    let totalSalesAmount = 0;
    let totalCouponDeduction = 0;
    let overAllOrderAmount = 0;
    let salesCount = 0;
    let overallRevenue = 0;

    // Calculate statistics from ALL search results
    allSearchResults.forEach((order) => {
      const isValidPayment =
        order.paymentStatus === "Payment Successful" &&
        (order.paymentMethod === "RazorPay" || order.paymentMethod === "Wallet");

      let orderTotal = 0;

      order.orderedItem.forEach((item) => {
        if (item.productStatus !== "Order Cancelled") {
          orderTotal += item.totalProductAmount;
          overAllOrderAmount += item.totalProductAmount;
        }
      });

      totalSalesAmount += orderTotal;

      if (isValidPayment) {
        overallRevenue += orderTotal;
      }

      totalCouponDeduction += order.couponDeduction;
      salesCount++;
    });

    // Get total count of search results for pagination
    const totalSearchCount = await order.countDocuments(searchCriteria);
    const totalPages = Math.ceil(totalSearchCount / perPage);

    console.log("Search Results Count:========>", totalSearchCount);
    console.log("=============================================");
    console.log("=============================================");
    console.log("Total Sales Count:========>", searchResults);
    console.log("=============================================");
    console.log("=============================================");
    
    

    res.json( {
      salesReport: searchResults, // Only paginated search results for table
      totalSalesAmount, // Calculated from all search results
      totalCouponDeduction, // Calculated from all search results
      salesCount, // Count of all search results
      overAllOrderAmount, // Calculated from all search results
      totalPages,
      currentPage: page,
      overallRevenue, // Calculated from all search results
      totalSalesCount: totalSearchCount, // Total search results count
      searchQuery // Pass search query back to view for maintaining search state
    });

  } catch (error) {
    console.error("Error in sales search:", error.message);
    res
      .status(StatusCodes.INTERNAL_SERVER_ERROR)
      .json({ message: "Something went wrong during search" });
  }
};


const dailySalesReport = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const perPage = 10;
    const skip = (page - 1) * perPage;

    // Date filter for today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    // Paginated daily orders
    const salesReport = await order
      .find({
        shippingDate: { $gte: today, $lt: tomorrow },
      })
      .populate("orderedItem.productId")
      .populate("deliveryAddress")
      .populate("userId")
      .sort({ _id: -1 })
      .skip(skip)
      .limit(perPage);

    // All daily orders (for statistics)
    const allTodayOrders = await order
      .find({
        shippingDate: { $gte: today, $lt: tomorrow },
      })
      .populate("orderedItem.productId")
      .populate("deliveryAddress")
      .populate("userId")
      .sort({ _id: -1 });

    let totalSalesAmount = 0;
    let totalCouponDeduction = 0;
    let overAllOrderAmount = 0;
    let salesCount = 0;
    let overallRevenue = 0;

    allTodayOrders.forEach((order) => {
      const isValidPayment =
        order.paymentStatus === "Payment Successful" &&
        (order.paymentMethod === "RazorPay" || order.paymentMethod === "Wallet");

      let orderTotal = 0;

      order.orderedItem.forEach((item) => {
        if (item.productStatus !== "Order Cancelled") {
          orderTotal += item.totalProductAmount;
          overAllOrderAmount += item.totalProductAmount;
        }
      });

      totalSalesAmount += orderTotal;

      if (isValidPayment) {
        overallRevenue += orderTotal;
      }

      totalCouponDeduction += order.couponDeduction;
      salesCount++;
    });

    const totalSalesCount = allTodayOrders.length;
    const totalPages = Math.ceil(totalSalesCount / perPage);

    res.status(StatusCodes.OK).render("admin/salesreport", {
      salesReport, // Only paginated daily data
      totalSalesAmount,
      totalCouponDeduction,
      salesCount,
      overAllOrderAmount,
      totalPages,
      currentPage: page,
      overallRevenue,
      totalSalesCount
    });
  } catch (error) {
    console.error("Error generating daily sales report:", error.message);
    res
      .status(StatusCodes.INTERNAL_SERVER_ERROR)
      .json({ message: "Something went wrong" });
  }
};

const weeklySalesReport = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const perPage = 10;
    const skip = (page - 1) * perPage;

    // Calculate start and end of current week (Monday to Sunday)
    const currentDate = new Date();
    const startOfWeek = new Date(currentDate);
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay() + (startOfWeek.getDay() === 0 ? -6 : 1));
    startOfWeek.setHours(0, 0, 0, 0);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 7);
    endOfWeek.setHours(0, 0, 0, 0);

    // Paginated weekly orders
    const salesReport = await order
      .find({
        shippingDate: { $gte: startOfWeek, $lt: endOfWeek },
      })
      .populate("orderedItem.productId")
      .populate("deliveryAddress")
      .populate("userId")
      .sort({ _id: -1 })
      .skip(skip)
      .limit(perPage);

    // All weekly orders (for statistics)
    const allWeekOrders = await order
      .find({
        shippingDate: { $gte: startOfWeek, $lt: endOfWeek },
      })
      .populate("orderedItem.productId")
      .populate("deliveryAddress")
      .populate("userId")
      .sort({ _id: -1 });

    let totalSalesAmount = 0;
    let totalCouponDeduction = 0;
    let overAllOrderAmount = 0;
    let salesCount = 0;
    let overallRevenue = 0;

    allWeekOrders.forEach((order) => {
      const isValidPayment =
        order.paymentStatus === "Payment Successful" &&
        (order.paymentMethod === "RazorPay" || order.paymentMethod === "Wallet");

      let orderTotal = 0;

      order.orderedItem.forEach((item) => {
        if (item.productStatus !== "Order Cancelled") {
          orderTotal += item.totalProductAmount;
          overAllOrderAmount += item.totalProductAmount;
        }
      });

      totalSalesAmount += orderTotal;

      if (isValidPayment) {
        overallRevenue += orderTotal;
      }

      totalCouponDeduction += order.couponDeduction;
      salesCount++;
    });

    const totalSalesCount = allWeekOrders.length;
    const totalPages = Math.ceil(totalSalesCount / perPage);

    res.status(StatusCodes.OK).render("admin/salesreport", {
      salesReport, // Paginated weekly data
      totalSalesAmount,
      totalCouponDeduction,
      salesCount,
      overAllOrderAmount,
      totalPages,
      currentPage: page,
      overallRevenue,
      totalSalesCount
    });
  } catch (error) {
    console.error("Error generating weekly sales report:", error.message);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: "Something went wrong" });
  }
};

const monthlySalesReport = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const perPage = 10;
    const skip = (page - 1) * perPage;

    const currentDate = new Date();

    // First and last day of the current month
    const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    startOfMonth.setHours(0, 0, 0, 0);

    const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
    endOfMonth.setHours(23, 59, 59, 999);

    // Paginated monthly orders
    const salesReport = await order
      .find({
        shippingDate: { $gte: startOfMonth, $lte: endOfMonth },
      })
      .populate("orderedItem.productId")
      .populate("deliveryAddress")
      .populate("userId")
      .sort({ _id: -1 })
      .skip(skip)
      .limit(perPage);

    // All monthly orders for stats
    const allMonthOrders = await order
      .find({
        shippingDate: { $gte: startOfMonth, $lte: endOfMonth },
      })
      .populate("orderedItem.productId")
      .populate("deliveryAddress")
      .populate("userId")
      .sort({ _id: -1 });

    let totalSalesAmount = 0;
    let totalCouponDeduction = 0;
    let overAllOrderAmount = 0;
    let salesCount = 0;
    let overallRevenue = 0;

    allMonthOrders.forEach((order) => {
      const isValidPayment =
        order.paymentStatus === "Payment Successful" &&
        (order.paymentMethod === "RazorPay" || order.paymentMethod === "Wallet");

      let orderTotal = 0;

      order.orderedItem.forEach((item) => {
        if (item.productStatus !== "Order Cancelled") {
          orderTotal += item.totalProductAmount;
          overAllOrderAmount += item.totalProductAmount;
        }
      });

      totalSalesAmount += orderTotal;

      if (isValidPayment) {
        overallRevenue += orderTotal;
      }

      totalCouponDeduction += order.couponDeduction;
      salesCount++;
    });

    const totalSalesCount = allMonthOrders.length;
    const totalPages = Math.ceil(totalSalesCount / perPage);

    res.status(StatusCodes.OK).render("admin/salesreport", {
      salesReport, // Paginated monthly data
      totalSalesAmount,
      totalCouponDeduction,
      salesCount,
      overAllOrderAmount,
      totalPages,
      currentPage: page,
      overallRevenue,
      totalSalesCount
    });
  } catch (error) {
    console.error("Error generating monthly sales report:", error.message);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: "Something went wrong" });
  }
};


const yearlySalesReport = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const perPage = 10;
    const skip = (page - 1) * perPage;

    const currentDate = new Date();

    // First and last day of the current year
    const startOfYear = new Date(currentDate.getFullYear(), 0, 1);
    startOfYear.setHours(0, 0, 0, 0);

    const endOfYear = new Date(currentDate.getFullYear(), 11, 31);
    endOfYear.setHours(23, 59, 59, 999);

    // Paginated yearly orders
    const salesReport = await order
      .find({
        shippingDate: { $gte: startOfYear, $lte: endOfYear },
      })
      .populate("orderedItem.productId")
      .populate("deliveryAddress")
      .populate("userId")
      .sort({ _id: -1 })
      .skip(skip)
      .limit(perPage);

    // All yearly orders for stats
    const allYearOrders = await order
      .find({
        shippingDate: { $gte: startOfYear, $lte: endOfYear },
      })
      .populate("orderedItem.productId")
      .populate("deliveryAddress")
      .populate("userId")
      .sort({ _id: -1 });

    let totalSalesAmount = 0;
    let totalCouponDeduction = 0;
    let overAllOrderAmount = 0;
    let salesCount = 0;
    let overallRevenue = 0;

    allYearOrders.forEach((order) => {
      const isValidPayment =
        order.paymentStatus === "Payment Successful" &&
        (order.paymentMethod === "RazorPay" || order.paymentMethod === "Wallet");

      let orderTotal = 0;

      order.orderedItem.forEach((item) => {
        if (item.productStatus !== "Order Cancelled") {
          orderTotal += item.totalProductAmount;
          overAllOrderAmount += item.totalProductAmount;
        }
      });

      totalSalesAmount += orderTotal;

      if (isValidPayment) {
        overallRevenue += orderTotal;
      }

      totalCouponDeduction += order.couponDeduction;
      salesCount++;
    });

    const totalSalesCount = allYearOrders.length;
    const totalPages = Math.ceil(totalSalesCount / perPage);

    res.status(StatusCodes.OK).render("admin/salesreport", {
      salesReport, // Paginated yearly data
      totalSalesAmount,
      totalCouponDeduction,
      salesCount,
      overAllOrderAmount,
      totalPages,
      currentPage: page,
      overallRevenue,
      totalSalesCount
    });
  } catch (error) {
    console.error("Error generating yearly sales report:", error.message);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: "Something went wrong" });
  }
};


const filterCustomDate = async (req, res) => {
  try {
    let { startDate, endDate } = req.body;

    // Handle combined date string like "2025-08-09 2025-08-09"
    if (typeof startDate === "string" && startDate.includes(" ")) {
      const parts = startDate.trim().split(" ");
      startDate = parts[0];
      endDate = parts[1] || parts[0];
    }

    if (!startDate || !endDate) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        message: "Start date and end date are required",
      });
    }

    console.log("Filtering from", startDate, "to", endDate);

    // Fetch all orders
    const salesReport = await order
      .find()
      .populate("orderedItem.productId")
      .populate("deliveryAddress")
      .populate("userId")
      .sort({ _id: -1 });

    // Adjust start and end for comparison
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    // Filter by date
    const filteredSalesReport = salesReport.filter((item) => {
      const shippingDate = new Date(item.shippingDate);
      return shippingDate >= start && shippingDate <= end;
    });

    // Stats calculation (same as monthlySalesReport)
    let totalSalesAmount = 0;
    let totalCouponDeduction = 0;
    let overAllOrderAmount = 0;
    let salesCount = 0;
    let overallRevenue = 0;

    filteredSalesReport.forEach((order) => {
      const isValidPayment =
        order.paymentStatus === "Payment Successful" &&
        (order.paymentMethod === "RazorPay" || order.paymentMethod === "Wallet");

      let orderTotal = 0;
      order.orderedItem.forEach((item) => {
        if (item.productStatus !== "Order Cancelled") {
          orderTotal += item.totalProductAmount;
          overAllOrderAmount += item.totalProductAmount;
        }
      });

      totalSalesAmount += orderTotal;

      if (isValidPayment) {
        overallRevenue += orderTotal;
      }

      totalCouponDeduction += order.couponDeduction;
      salesCount++;
    });

    const totalSalesCount = filteredSalesReport.length;
    const totalPages = 1; // You can add pagination if needed

    res.status(StatusCodes.OK).json({
      filteredSalesReport,
      totalSalesAmount,
      totalCouponDeduction,
      salesCount,
      overAllOrderAmount,
      totalPages,
      currentPage: 1,
      overallRevenue,
      totalSalesCount
    });
  } catch (error) {
    console.error(error.message);
    res
      .status(StatusCodes.INTERNAL_SERVER_ERROR)
      .send("Internal Server Error");
  }
};

const brandManagement = async (req, res) => {
  try {
    const brandsData = await Brands.find();

    res.status(StatusCodes.OK).render("admin/brandlist", { brandsData });
  } catch (error) {
    console.log(error.message);
    return res
      .status(StatusCodes.INTERNAL_SERVER_ERROR)
      .send("Internal Server Error");
  }
};
const addNewBrand = async (req, res) => {
  try {
    const { brandName, brandItems } = req.body;

    const newBrand = new Brands({
      brandname: brandName,
      brandItems: brandItems,
    });

    await newBrand.save();

    res
      .status(StatusCodes.OK)
      .json({ message: "New Branded Added Successfully" });
  } catch (error) {
    console.log(error.message);
    return res
      .status(StatusCodes.INTERNAL_SERVER_ERROR)
      .send("Internal Server Error");
  }
};

const downloadSalesReport = async (req, res) => {
  try {
    const { html } = req.body;
    const browser = await puppeteer.launch();
    const page = await browser.newPage();

    await page.setContent(html);
    const pdfBuffer = await page.pdf();
    await browser.close();

    res.setHeader("Content-Type", "application/pdf");
    res.send(pdfBuffer);
  } catch (error) {
    console.error("Error generating PDF:", error);
    return res
      .status(StatusCodes.INTERNAL_SERVER_ERROR)
      .send("Internal Server Error");
  }
};

const graphData = async (req, res) => {
  try {
    const { year, type } = req.body;

    if (type === "month") {
      const salesData = Array(12).fill(0);
      const revenueData = Array(12).fill(0);

      const startDate = new Date(year, 0, 1);
      const endDate = new Date(year, 11, 31, 23, 59, 59);
      const allData = await order
        .find({
          shippingDate: { $gte: startDate, $lte: endDate },
        })
        .populate("orderedItem.productId")
        .populate("deliveryAddress")
        .populate("userId")
        .sort({ _id: -1 });

      allData.forEach((item) => {
        const month = item.shippingDate.getMonth();
        salesData[month] += item.orderAmount;
        if (item.paymentStatus === "Payment Successful") {
          revenueData[month] += item.orderAmount;
        }
      });

      res.json({
        labels: [
          "January",
          "February",
          "March",
          "April",
          "May",
          "June",
          "July",
          "August",
          "September",
          "October",
          "November",
          "December",
        ],
        salesData,
        revenueData,
      });
    } else if (type === "year") {
      if (year === "2024") {
        const currentYear = new Date().getFullYear();
        const pastYears = Array.from({ length: 5 }, (_, i) => currentYear - i);
        const salesData = Array(5).fill(0);
        const revenueData = Array(5).fill(0);

        for (let i = 0; i < 5; i++) {
          const startDate = new Date(pastYears[i], 0, 1);
          const endDate = new Date(pastYears[i], 11, 31, 23, 59, 59);
          const allData = await order
            .find({
              shippingDate: { $gte: startDate, $lte: endDate },
            })
            .populate("orderedItem.productId")
            .populate("deliveryAddress")
            .populate("userId")
            .sort({ _id: -1 });

          allData.forEach((item) => {
            salesData[i] += item.orderAmount;
            if (item.paymentStatus === "Payment Successfull") {
              revenueData[i] += item.orderAmount;
            }
          });
        }

        res.json({ labels: pastYears.map(String), salesData, revenueData });
      } else {
        res
          .status(StatusCodes.BAD_REQUEST)
          .json({ error: "Invalid year provided." });
      }
    } else {
      res
        .status(StatusCodes.BAD_REQUEST)
        .json({ error: "Invalid type provided." });
    }
  } catch (error) {
    console.log(error.message);
    res
      .status(StatusCodes.INTERNAL_SERVER_ERROR)
      .json({ error: "Failed to generate sales report." });
  }
};

const approveRetrunRequest = async (req, res) => {
  try {
    let {
      text,
      decision,
      productId,
      orderId,
      userId,
      totalProductAmount,
      quantity,
    } = req.body;
    console.log("req.body--------------------------------",req.body);
    

    if (decision === "approve") {
      // Mark product as returned, remove return request, and reduce order amount
      await order.findOneAndUpdate(
        { _id: orderId, "orderedItem.productId": productId },
        {
          $set: {
            "orderedItem.$.productStatus": "Returned",
            "orderedItem.$.returnRequest": false,
          },
          $inc: { orderAmount: -totalProductAmount } // 🔹 Minus from order total
        },
        { new: true }
      );

      // Refund to wallet
      await User.findByIdAndUpdate(
        userId,
        {
          $inc: { wallet: totalProductAmount },
          $push: {
            walletHistory: {
              amount: totalProductAmount,
              description: `Refund of ORDERID:${orderId}`,
              date: new Date(),
              status: "credit",
            },
          },
        },
        { new: true }
      );

      // Restore stock
      await Products.findOneAndUpdate(
        { _id: productId },
        { $inc: { productquadity: +quantity } }
      );

    } else if (decision === "reject") {
      // Just update status & remove return request
      await order.findOneAndUpdate(
        { _id: orderId, "orderedItem.productId": productId },
        {
          $set: {
            "orderedItem.$.productStatus": "Return request rejected",
            "orderedItem.$.returnRequest": false,
          },
        },
        { new: true }
      );
    }

    res.status(StatusCodes.OK).json({ message: "updated successfully" });

  } catch (error) {
    console.log(error.message);
    res
      .status(StatusCodes.INTERNAL_SERVER_ERROR)
      .json({ error: "Failed to approve/reject return request." });
  }
};


const deleteOffer = async (req, res) => {
  try {
    const { offerId } = req.body;

    await Offer.findByIdAndDelete({ _id: offerId });
    await Products.updateMany(
      { offerId: offerId },
      { $unset: { offerId: "" } }
    );
    res.status(StatusCodes.OK).json({ message: "success" });
  } catch (error) {
    console.log(error.message);
    res
      .status(StatusCodes.INTERNAL_SERVER_ERROR)
      .json({ error: "Failed to generate sales report." });
  }
};

module.exports = {
  loadAdminLogin,
  adminDashboard,
  adminOrdersList,
  adminOrderDetiles,
  adminChangeOrderStatus,
  admincouponlist,
  addNewCoupon,
  admincouponmanagement,
  deleteCoupon,
  adminOfferList,
  createCoupon,
  addNewOffer,
  selectOfferType,
  totalSalesReport,
  dailySalesReport,
  weeklySalesReport,
  monthlySalesReport,
  yearlySalesReport,
  filterCustomDate,
  brandManagement,
  addNewBrand,
  downloadSalesReport,
  graphData,
  approveRetrunRequest,
  deleteOffer,
  searchCoupon,
  salesSearch
};
