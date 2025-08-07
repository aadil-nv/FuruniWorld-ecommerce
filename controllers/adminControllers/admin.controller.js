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
    const salesReport = await order
      .find()
      .populate("orderedItem.productId")
      .populate("deliveryAddress")
      .populate("userId")
      .sort({ _id: 1 });
    const productCount = await Products.countDocuments();
    const categoryCount = await Category.countDocuments();
    let totalSalesAmount = 0;
    let totalSalesAmount2 = 0;
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth() + 1;
    const currentYear = currentDate.getFullYear();

    

    salesReport.forEach((order) => {
      order.orderedItem.forEach((item) => {
        // console.log("product status $$$$$$$$$$$$$$$$$$$$$", item.productStatus);
        
        if (item.productStatus === "Delivered" || item.productStatus === "pending") {
          if (order.couponDeduction == 0) {
            totalSalesAmount += item.totalProductAmount;
          } else {
            totalSalesAmount2 += item.totalProductAmount;
            totalSalesAmount = totalSalesAmount2 - order.couponDeduction;
          }
        }
      });
    });

    let totalCouponDeduction = 0;
    salesReport.forEach((item) => {
      totalCouponDeduction += item.couponDeduction;
    });
    let salesCount = 0;
    salesReport.forEach((item) => {
      salesCount++;
    });
    let overAllOrderAmount = 0;
    salesReport.forEach((item) => {
      overAllOrderAmount += item.orderAmount;
    });

    const salesReport2 = await order
      .find({
        paymentStatus: "Payment Successful",
        $expr: {
          $eq: [{ $month: "$shippingDate" }, currentMonth],
          $eq: [{ $year: "$shippingDate" }, currentYear],
        },
      })
      .populate("orderedItem.productId")
      .populate("deliveryAddress")
      .populate("userId")
      .sort({ _id: 1 });

    let monthlyEarning = 0;

salesReport2.forEach((order) => {
  order.orderedItem.forEach((item) => {
    if (item.productStatus !== 'Order Cancelled') {
      monthlyEarning += item.totalProductAmount;
    }
  });
});


    console.log("salesReport2", monthlyEarning);

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

    // console.log("salesReport ==========>", salesReport.orderAmount);
    

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
    const orderData = await order
      .findById({ _id: orderId })
      .populate("orderedItem.productId")
      .populate("deliveryAddress")
      .populate("userId");

    res.status(StatusCodes.OK).render("admin/orderdetiles", { orderData });
  } catch (error) {
    console.log(error.message);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).send("Internal Server Error");
  }
};

const adminChangeOrderStatus = async (req, res) => {
  try {
    const { selectedStatus, productId, orderId } = req.body;

    const orderData = await order
      .find({ _id: orderId })
      .populate("orderedItem.productId")
      .populate("deliveryAddress")
      .populate("userId");

    if (selectedStatus === "null") {
      return res.status(400).json({ message: "selectedStatus is null" });
    }

    const updatedOrder = await order
      .findOneAndUpdate(
        { _id: orderId, "orderedItem.productId": productId },
        { $set: { "orderedItem.$.productStatus": selectedStatus } },
        { new: true }
      )
      .populate("orderedItem.productId")
      .populate("deliveryAddress")
      .populate("userId");

    if (!updatedOrder) {
      return res
        .status(StatusCodes.NOT_FOUND)
        .json({ message: "Order not found" });
    }

    console.log("Updated order:", updatedOrder);
    res
      .status(StatusCodes.OK)
      .json({ message: "Order status updated successfully", updatedOrder });
  } catch (error) {
    console.log(error.message);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).send("Internal Server Error");
  }
};

const admincouponlist = async (req, res) => {
  try {
    const couponData = await Coupon.find().sort({_id:-1});
    res.status(StatusCodes.OK).render("admin/couponlist", { couponData });
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

    const salesReport = await order
      .find()
      .populate("orderedItem.productId")
      .populate("deliveryAddress")
      .populate("userId")
      .sort({ _id: -1 })
      .skip(skip)
      .limit(perPage);

    let totalSalesAmount = 0;
    let totalCouponDeduction = 0;
    let overAllOrderAmount = 0;
    let salesCount = 0;
    let overallRevenue = 0; // 🆕 Add overall revenue field

   salesReport.forEach((order) => {
  console.log("=============================");
  console.log("order", order);
  console.log("=============================");

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

  // ✅ Add total of non-cancelled products to totalSalesAmount
  totalSalesAmount += orderTotal;

  // ✅ Add only if payment is valid
  if (isValidPayment) {
    overallRevenue += orderTotal;
  }

  totalCouponDeduction += order.couponDeduction;
  // overAllOrderAmount += order.orderAmount;
  salesCount++;
});

    const totalSalesCount = await order.countDocuments();
    const totalPages = Math.ceil(totalSalesCount / perPage);
    console.log("overallRevenue==========>", overallRevenue);
    

    res.status(StatusCodes.OK).render("admin/salesreport", {
      salesReport,
      totalSalesAmount,
      totalCouponDeduction,
      salesCount,
      overAllOrderAmount,
      totalPages,
      currentPage: page,
      overallRevenue, // 🆕 send revenue to view
    });
  } catch (error) {
    console.error("Error generating sales report:", error.message);
    res
      .status(StatusCodes.INTERNAL_SERVER_ERROR)
      .json({ message: "Something went wrong" });
  }
};


const dailySalesReport = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const perPage = 10;
    const skip = (page - 1) * perPage;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    const salesReport = await order
      .find({
        shippingDate: { $gte: today, $lt: tomorrow },
      })
      .sort({ _id: -1 })
      .skip(skip)
      .limit(perPage);

    const allTodayOrders = await order.find({
      shippingDate: { $gte: today, $lt: tomorrow },
    });

    let totalSalesAmount = 0;
    let totalCouponDeduction = 0;
    let overAllOrderAmount = 0;

    salesReport.forEach((order) => {
      totalCouponDeduction += order.couponDeduction;
      overAllOrderAmount += order.orderAmount;

      order.orderedItem.forEach((item) => {
        if (item.productStatus === "Delivered") {
          if (order.couponDeduction === 0) {
            totalSalesAmount += item.totalProductAmount;
          } else {
            totalSalesAmount += item.totalProductAmount - order.couponDeduction;
          }
        }
      });
    });

    const totalSalesCount = allTodayOrders.length;
    const totalPages = Math.ceil(totalSalesCount / perPage);

    res.status(StatusCodes.OK).render("admin/salesreport", {
      salesReport,
      totalSalesAmount,
      totalCouponDeduction,
      salesCount: salesReport.length,
      overAllOrderAmount,
      totalPages,
      currentPage: page,
    });
  } catch (error) {
    console.log(error.message);
    res
      .status(StatusCodes.INTERNAL_SERVER_ERROR)
      .send("Error generating report");
  }
};
const weeklySalesReport = async (req, res) => {
  try {
    const page = req.query.page || 1;
    const perPage = 10;
    const skip = (page - 1) * perPage;
    const currentDate = new Date();

    const startOfWeek = new Date(currentDate);
    startOfWeek.setDate(
      startOfWeek.getDate() -
        startOfWeek.getDay() +
        (startOfWeek.getDay() === 0 ? -6 : 1)
    );

    const endOfWeek = new Date(currentDate);
    endOfWeek.setDate(endOfWeek.getDate() - endOfWeek.getDay() + 7);

    const salesReport = await order
      .find({
        shippingDate: { $gte: startOfWeek, $lte: endOfWeek },
      })
      .sort({ _id: -1 })
      .skip(skip)
      .limit(perPage);

    let sc = await order.find({
      shippingDate: { $gte: startOfWeek, $lte: endOfWeek },
    });

    let totalSalesAmount = 0;
    let totalSalesAmount2 = 0;

    salesReport.forEach((order) => {
      order.orderedItem.forEach((item) => {
        if (item.productStatus === "Delivered") {
          console.log("order.couponDeduction ::::", order.couponDeduction);
          if (order.couponDeduction == 0) {
            totalSalesAmount += item.totalProductAmount;
          } else {
            totalSalesAmount2 += item.totalProductAmount;
            totalSalesAmount = totalSalesAmount2 - order.couponDeduction;
          }
        }
      });
    });

    let totalCouponDeduction = 0;
    salesReport.forEach((item) => {
      totalCouponDeduction += item.couponDeduction;
    });
    let salesCount = 0;
    salesReport.forEach((item) => {
      salesCount++;
    });
    let overAllOrderAmount = 0;
    salesReport.forEach((item) => {
      overAllOrderAmount += item.orderAmount;
    });

    let totalSalesCount = sc.length;
    const totalPages = Math.ceil(totalSalesCount / perPage);

    res
      .status(StatusCodes.OK)
      .render("admin/salesreport", {
        salesReport,
        totalSalesAmount,
        totalCouponDeduction,
        salesCount,
        overAllOrderAmount,
        totalPages,
        currentPage: page,
      });
  } catch (error) {
    console.log(error.message);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).send("Internal Server Error");
  }
};

const monthlySalesReport = async (req, res) => {
  try {
    const page = req.query.page || 1;
    const perPage = 10;
    const skip = (page - 1) * perPage;

    const currentDate = new Date();

    const startOfMonth = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth(),
      1
    );

    const endOfMonth = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth() + 1,
      0
    );

    const salesReport = await order
      .find({
        shippingDate: { $gte: startOfMonth, $lte: endOfMonth },
      })
      .sort({ _id: -1 })
      .skip(skip)
      .limit(perPage);

    let sc = await order
      .find({
        shippingDate: { $gte: startOfMonth, $lte: endOfMonth },
      })
      .sort({ _id: -1 });

    let totalSalesAmount = 0;
    let totalSalesAmount2 = 0;

    salesReport.forEach((order) => {
      order.orderedItem.forEach((item) => {
        if (item.productStatus === "Delivered") {
          console.log("order.couponDeduction ::::", order.couponDeduction);
          if (order.couponDeduction == 0) {
            totalSalesAmount += item.totalProductAmount;
          } else {
            totalSalesAmount2 += item.totalProductAmount;
            totalSalesAmount = totalSalesAmount2 - order.couponDeduction;
          }
        }
      });
    });

    let totalCouponDeduction = 0;
    salesReport.forEach((item) => {
      totalCouponDeduction += item.couponDeduction;
    });
    let salesCount = 0;
    salesReport.forEach((item) => {
      salesCount++;
    });
    let overAllOrderAmount = 0;
    salesReport.forEach((item) => {
      overAllOrderAmount += item.orderAmount;
    });

    let totalSalesCount = sc.length;
    let totalPages = Math.ceil(totalSalesCount / perPage);

    res
      .status(StatusCodes.OK)
      .render("admin/salesreport", {
        salesReport,
        totalSalesAmount,
        totalCouponDeduction,
        salesCount,
        overAllOrderAmount,
        totalPages,
        currentPage: page,
      });
  } catch (error) {
    console.log(error.message);
    return res
      .status(StatusCodes.INTERNAL_SERVER_ERROR)
      .send("Internal Server Error");
  }
};

const yearlySalesReport = async (req, res) => {
  try {
    const page = req.query.page || 1;
    const perPage = 10;
    const skip = (page - 1) * perPage;

    const currentDate = new Date();

    const startOfYear = new Date(currentDate.getFullYear(), 0, 1);

    const endOfYear = new Date(currentDate.getFullYear(), 11, 31);

    const salesReport = await order
      .find({
        shippingDate: { $gte: startOfYear, $lte: endOfYear },
      })
      .sort({ _id: -1 })
      .skip(skip)
      .limit(perPage);

    let sc = await order
      .find({
        shippingDate: { $gte: startOfYear, $lte: endOfYear },
      })
      .sort({ _id: -1 });

    let totalSalesAmount = 0;
    let totalSalesAmount2 = 0;

    salesReport.forEach((order) => {
      order.orderedItem.forEach((item) => {
        if (item.productStatus === "Delivered") {
          console.log("order.couponDeduction ::::", order.couponDeduction);
          if (order.couponDeduction == 0) {
            totalSalesAmount += item.totalProductAmount;
          } else {
            totalSalesAmount2 += item.totalProductAmount;
            totalSalesAmount = totalSalesAmount2 - order.couponDeduction;
          }
        }
      });
    });

    let totalCouponDeduction = 0;
    salesReport.forEach((item) => {
      totalCouponDeduction += item.couponDeduction;
    });
    let salesCount = 0;
    salesReport.forEach((item) => {
      salesCount++;
    });
    let overAllOrderAmount = 0;
    salesReport.forEach((item) => {
      overAllOrderAmount += item.orderAmount;
    });

    let totalSalesCount = sc.length;
    const totalPages = Math.ceil(totalSalesCount / perPage);

    res
      .status(StatusCodes.OK)
      .render("admin/salesreport", {
        salesReport,
        totalSalesAmount,
        totalCouponDeduction,
        salesCount,
        overAllOrderAmount,
        totalPages,
        currentPage: page,
      });
  } catch (error) {
    console.log(error.message);
    return res
      .status(StatusCodes.INTERNAL_SERVER_ERROR)
      .send("Internal Server Error");
  }
};

const filterCustomDate = async (req, res) => {
  try {
    const salesReport = await order
      .find()
      .populate("orderedItem.productId")
      .populate("deliveryAddress")
      .populate("userId")
      .sort({ _id: -1 });

    const { startDate, endDate } = req.body;
    const adjustedEndDate = new Date(endDate);
    adjustedEndDate.setDate(adjustedEndDate.getDate() + 1);

    const filteredSalesReport = salesReport.filter((item) => {
      const shippingDate = new Date(item.shippingDate);
      return (
        shippingDate >= new Date(startDate) && shippingDate < adjustedEndDate
      );
    });

    res.status(StatusCodes.OK).json({ filteredSalesReport });
  } catch (error) {
    console.log(error.message);
    return res
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
  console.log("approveRetrunRequest is calling=============>");
  
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

    console.log("req.body  approveRetrunRequest==========>", req.body);
    

    // console.log("req.body", req.body);
    // console.log("decision ==============>", decision);
    
    

    if (decision === "approve") {
      await order.findOneAndUpdate(
        { _id: orderId, "orderedItem.productId": productId },
        {
          $set: {
            "orderedItem.$.productStatus": "Returned",
            "orderedItem.$.returnRequest": false,
          },
        },
        { new: true }
      );

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

      await Products.findOneAndUpdate(
        { _id: productId },
        { $inc: { productquadity: +quantity } }
      );
    } else if (decision === "reject") {
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

    res.status(StatusCodes.OK).json({ message: "updated successsfully" });
  } catch (error) {
    console.log(error.message);
    res
      .status(StatusCodes.INTERNAL_SERVER_ERROR)
      .json({ error: "Failed to generate sales report." });
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
};
