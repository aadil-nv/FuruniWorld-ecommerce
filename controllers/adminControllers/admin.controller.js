const express = require("express");
const session = require("express-session");
const Products = require("../../models/productModel");
const sharp = require("sharp");
const order = require("../../models/orderModal");
const Coupon = require("../../models/couponModal");
const Offer = require("../../models/offerModal");
const Category = require("../../models/categoryModel");
const Brands = require("../../models/brandsModel");
const puppeteer= require("puppeteer")





const loadAdminLogin =async (req,res)=>{
  try {
    res.render("admin/adminlogin");
  } catch (error) {
    console.error("Error from loadAdminLogin",error);
  }
}


const adminDashboard = async (req, res) => {
  try {
    const salesReport= await order.find().populate("orderedItem.productId").populate("deliveryAddress").populate("userId").sort({_id:1})
    const productCount= await Products.countDocuments()
    const categoryCount= await Category.countDocuments()
    let totalSalesAmount = 0;
    let totalSalesAmount2 = 0;
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth() + 1;
    const currentYear = currentDate.getFullYear();
    

    salesReport.forEach(order => {
      order.orderedItem.forEach(item => {
        if (item.productStatus === "Delivered") {
          
          if(order.couponDeduction == 0){
          totalSalesAmount += item.totalProductAmount;
        }else{
          totalSalesAmount2 += item.totalProductAmount
          totalSalesAmount=totalSalesAmount2-order.couponDeduction
        }
      }
      });
    });

    let totalCouponDeduction=0
    salesReport.forEach(item=>{
      totalCouponDeduction += item.couponDeduction
    })
    let salesCount=0
    salesReport.forEach(item=>{
      salesCount++
    })
    let overAllOrderAmount=0
    salesReport.forEach(item=>{
      overAllOrderAmount+= item.orderAmount
    })
    
    const salesReport2 = await order.find({
      paymentStatus: "Payment Successfull",
      $expr: {
          $eq: [{ $month: "$shippingDate" }, currentMonth],
          $eq: [{ $year: "$shippingDate" }, currentYear]
      }
  }).populate("orderedItem.productId").populate("deliveryAddress").populate("userId").sort({ _id: 1 });

  let monthlyEarning = 0;
 
  salesReport2.forEach(order => {
    monthlyEarning+= order.orderAmount
  });

  console.log("salesReport2",monthlyEarning)


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
      as: "productDetails"
    }
  },
  { $unwind: "$productDetails" },
  {
    $group: {
      _id: "$productDetails.categoryId",
      totalQuantity: { $sum: "$orderedItem.quantity" }
    }
  },
  { $sort: { totalQuantity: -1 } },
  { $limit: 10 }
]);


const mostBoughtBrands = await order.aggregate([
  { $unwind: "$orderedItem" },
  {
    $lookup: {
      from: "products",
      localField: "orderedItem.productId",
      foreignField: "_id",
      as: "productDetails"
    }
  },
  { $unwind: "$productDetails" },
  {
    $group: {
      _id: "$productDetails.brand",
      totalQuantity: { $sum: "$orderedItem.quantity" }
    }
  },
  { $sort: { totalQuantity: -1 } },
  { $limit: 10 }
]);

    res.render("admin/admindashboard",{salesReport,totalSalesAmount,totalCouponDeduction,
      salesCount,overAllOrderAmount,productCount,categoryCount,monthlyEarning,mostBoughtProducts,mostBoughtCategories,mostBoughtBrands});
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

      res.render("admin/orderlist", {
          orderData,
          currentPage: page,
          totalPages: Math.ceil(count / perPage)
      });
  } catch (error) {
      console.log(error.message);
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

    res.render("admin/orderdetiles", { orderData });
  } catch (error) {
    console.log(error.message);
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
      return res.status(404).json({ message: "Order not found" });
    }

    console.log("Updated order:", updatedOrder);
    res
      .status(200)
      .json({ message: "Order status updated successfully", updatedOrder });
  } catch (error) {
    console.log(error.message);
  }
};

const admincouponlist = async (req, res) => {
  try {

    const couponData = await Coupon.find()
    res.render('admin/couponlist', { couponData })

  } catch (error) {
    console.log(error.message)
  }
}


const admincouponmanagement = async (req, res) => {
  try {

    res.render('admin/createcoupon')

  } catch (error) {
    console.log(error.message)
  }
}

const addNewCoupon = async (req, res) => {
  try {

    const { data } = req.body


    if (!data) {
      res.json({ message: "failed" })

    } else {
      const couponname = data.couponName
      const couponcode = data.couponCode
      console.log(":::::::::::::::::::::::::::::::::::::::")
      console.log(couponcode)
      console.log(":::::::::::::::::::::::::::::::::::::::")

      const existingCouponName = await Coupon.findOne({ couponName:couponname });
      console.log("existingCouponName::",existingCouponName)
      const existingCouponCode = await Coupon.findOne({ couponCode:couponcode });
      console.log("existingCouponCode >>",existingCouponCode)

      if (existingCouponName ) {
        return res.json({ message: "Coupon name already exists" });
      }
       if (existingCouponCode) {
        return res.json({ message: "Coupon code already exists" });
      } 

      const couponData = new Coupon({

        couponName: data.couponName,
        couponCode: data.couponCode,
        discountAmount: data.couponDiscount,
        minAmount: data.couponMinAmount,
        couponDescription: data.couponDescription,
        expiryDate: data.couponExpire,
        status: true,


      })
      await couponData.save()
      res.json({ message: "Success" })
    
    }
  } catch (error) {
    console.log(error.message)
  }
}

const deleteCoupon = async (req, res) => {
  try {
    const { data } = req.body


    if (!data) {
      res.json({ message: "delete failed" })
    } else {
      await Coupon.findByIdAndDelete({ _id: data })
      res.json({ message: "delete success" })
    }
  } catch (error) {
    console.log(error.message)
  }
}


const adminOfferList = async (req, res) => {
  try {
      const perPage = 5;
      const page = req.query.page || 1;

      const offerData = await Offer.find()
          .skip((page - 1) * perPage)
          .limit(perPage);

      const count = await Offer.countDocuments();

      res.render('admin/offerlist', {
          offerData,
          currentPage: page,
          totalPages: Math.ceil(count / perPage)
      });
  } catch (error) {
      console.log(error.message);
  }
};


const createCoupon = async (req, res) => {
  try {
    const categoryData = await Addcategory.find()
    const productData = await Products.find()


    res.render('admin/createoffer', { categoryData, productData })

  } catch (error) {
    console.log(error.message)
  }
}


const addNewOffer = async (req, res) => {
  try {
    const { data } = req.body

    const newOffer = new Offer({
      offerName: data.offerName,
      description: data.offerDescription,
      percentage: data.offerPercentage,
      expiryDate: data.offerExpiryDate,
      status: data.offerStatus,
      offerType: data.offerType,
      offerTypeName: data.offerItem,

    })
    await newOffer.save()
    res.status(200).json({ message: "Offer Added Successfully" })


    let newOfferData= newOffer

    

    const offerCategoryData = await Products.find({ categoryId: data.offerItem }).populate('offerId')

    console.log("&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&")
    console.log(offerCategoryData)
    console.log("&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&")
    const offerProductData = await Products.findOne({ productname: data.offerItem }).populate('offerId')

    let productOldPercentage=offerProductData?.offerId?.percentage

    let categoryOldPercentage = 0;

    if (Array.isArray(offerCategoryData) && offerCategoryData.length > 0) {
      categoryOldPercentage = Math.max(...offerCategoryData.map(product => product.offerId?.percentage || 0));
    }
    
    
    console.log("^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^",categoryOldPercentage)
   
      if (newOffer.offerType === "category") {
        if( newOfferData.percentage > categoryOldPercentage  || categoryOldPercentage=== undefined){
          const offerCategoryData = await Products.find({ categoryId: newOfferData.offerTypeName })
         
          await Products.updateMany({ categoryId: newOfferData.offerTypeName }, { $set: { offerId:newOfferData} });
        
      }
      } else if(newOffer.offerType === "product") {

        if( newOfferData.percentage > productOldPercentage  || productOldPercentage=== undefined){
        const offerProductData = await Products.findOne({ productname: newOfferData.offerTypeName});

          await Products.findByIdAndUpdate(offerProductData._id, { $set: { offerId:newOfferData} });
         

        }
        
      }

  } catch (error) {
    console.log(error.message)
  }
}



const selectOfferType = async (req, res) => {
  try {
    const { selectedValue } = req.body

    if (selectedValue === "category") {
      const categoryData = await Addcategory.find()
      return res.json({ categoryData })

    } else {
      const productData = await Products.find()
      return res.json({ productData })

    }

  } catch (error) {
    console.log(error.message)
  }
}




const totalSalesReport = async (req, res) => {
  try {
    const page = req.query.page || 1; 
    const perPage = 10; 
    const skip = (page - 1) * perPage;
    const salesReport= await order.find().populate("orderedItem.productId").populate("deliveryAddress").populate("userId")
    .sort({ _id: -1 })
    .skip(skip)
    .limit(perPage);
    
    let totalSalesAmount = 0;
    let totalSalesAmount2 = 0;
    
    

    salesReport.forEach(order => {
      order.orderedItem.forEach(item => {
        if (item.productStatus === "Delivered") {
          console.log("order.couponDeduction ::::",order.couponDeduction)
          if(order.couponDeduction == 0){
          totalSalesAmount += item.totalProductAmount;
        }else{
          totalSalesAmount2 += item.totalProductAmount
          totalSalesAmount=totalSalesAmount2-order.couponDeduction
        }
      }
      });
    });

    let totalCouponDeduction=0
    salesReport.forEach(item=>{
      totalCouponDeduction += item.couponDeduction
    })
    let salesCount=0
    salesReport.forEach(item=>{
      salesCount++
    })
    let overAllOrderAmount=0
    salesReport.forEach(item=>{
      overAllOrderAmount+= item.orderAmount
    })
    
    const totalSalesCount = await order.countDocuments();
    const totalPages = Math.ceil(totalSalesCount / perPage);

   res.render('admin/salesreport',{salesReport,totalSalesAmount,totalCouponDeduction,
    salesCount,overAllOrderAmount, totalPages,
    currentPage: page})

  } catch (error) {
    console.log(error.message)
  }
}

const dailySalesReport= async(req,res)=>{
  try {
    const page = req.query.page || 1; 
    const perPage = 10; 
    const skip = (page - 1) * perPage;
    
    const today = new Date();
        today.setHours(0, 0, 0, 0); 
        const tomorrow = new Date(today);
        tomorrow.setDate(today.getDate() + 1); 

        const salesReport = await order.find({
            shippingDate: {
                $gte: today,
                $lt: tomorrow
            }
        }).sort({_id:-1}).skip(skip)
        .limit(perPage);

        let sc=await order.find({
          shippingDate: {
              $gte: today,
              $lt: tomorrow
          }
      }).sort({_id:-1})
    
    let totalSalesAmount = 0;
    let totalSalesAmount2 = 0;
    
    

    salesReport.forEach(order => {
      order.orderedItem.forEach(item => {
        if (item.productStatus === "Delivered") {
          console.log("order.couponDeduction ::::",order.couponDeduction)
          if(order.couponDeduction == 0){
          totalSalesAmount += item.totalProductAmount;
        }else{
          totalSalesAmount2 += item.totalProductAmount
          totalSalesAmount=totalSalesAmount2-order.couponDeduction
        }
      }
      });
    });

    let totalCouponDeduction=0
    salesReport.forEach(item=>{
      totalCouponDeduction += item.couponDeduction
    })
    let salesCount=0
    salesReport.forEach(item=>{
      salesCount++
    })
    let overAllOrderAmount=0
    salesReport.forEach(item=>{
      overAllOrderAmount+= item.orderAmount
    })

    let totalSalesCount = sc.length;
    const totalPages = Math.ceil(totalSalesCount / perPage);
    

    res.render('admin/salesreport',{salesReport,totalSalesAmount,totalCouponDeduction,
      salesCount,overAllOrderAmount, totalPages,
      currentPage: page}) 
    
  } catch (error) {
    console.log(error.message)
  }
}
const weeklySalesReport= async(req,res)=>{
  try {
    const page = req.query.page || 1; 
    const perPage = 10; 
    const skip = (page - 1) * perPage;
    const currentDate = new Date();


    const startOfWeek = new Date(currentDate);
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay() + (startOfWeek.getDay() === 0 ? -6 : 1));

    
    const endOfWeek = new Date(currentDate);
    endOfWeek.setDate(endOfWeek.getDate() - endOfWeek.getDay() + 7);

  
    const salesReport = await order.find({
        shippingDate: { $gte: startOfWeek, $lte: endOfWeek }
    }).sort({_id:-1}).skip(skip)
    .limit(perPage);

    let sc= await order.find({
      shippingDate: { $gte: startOfWeek, $lte: endOfWeek }
  })

    let totalSalesAmount = 0;
    let totalSalesAmount2 = 0;
    
    

    salesReport.forEach(order => {
      order.orderedItem.forEach(item => {
        if (item.productStatus === "Delivered") {
          console.log("order.couponDeduction ::::",order.couponDeduction)
          if(order.couponDeduction == 0){
          totalSalesAmount += item.totalProductAmount;
        }else{
          totalSalesAmount2 += item.totalProductAmount
          totalSalesAmount=totalSalesAmount2-order.couponDeduction
        }
      }
      });
    });

    let totalCouponDeduction=0
    salesReport.forEach(item=>{
      totalCouponDeduction += item.couponDeduction
    })
    let salesCount=0
    salesReport.forEach(item=>{
      salesCount++
    })
    let overAllOrderAmount=0
    salesReport.forEach(item=>{
      overAllOrderAmount+= item.orderAmount
    })

    let totalSalesCount = sc.length;
    const totalPages = Math.ceil(totalSalesCount / perPage);

    console.log("_____________________________")
    console.log(salesReport)
    console.log(totalPages)
    console.log("_____________________________")
    

    res.render('admin/salesreport',{salesReport,totalSalesAmount,totalCouponDeduction,
      salesCount,overAllOrderAmount ,totalPages,
      currentPage: page}) 
    
  } catch (error) {
    console.log(error.message)
  }
}


const monthlySalesReport= async(req,res)=>{
  try {
    const page = req.query.page || 1; 
    const perPage = 10; 
    const skip = (page - 1) * perPage;

    const currentDate = new Date();
    
    const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  
    const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);

    
    const salesReport = await order.find({
        shippingDate: { $gte: startOfMonth, $lte: endOfMonth }
    }).sort({_id:-1}).skip(skip)
    .limit(perPage);

    let sc= await order.find({
      shippingDate: { $gte: startOfMonth, $lte: endOfMonth }
  }).sort({_id:-1})

  
    
    let totalSalesAmount = 0;
    let totalSalesAmount2 = 0;
    
    

    salesReport.forEach(order => {
      order.orderedItem.forEach(item => {                                                                     
        if (item.productStatus === "Delivered") {
          console.log("order.couponDeduction ::::",order.couponDeduction)
          if(order.couponDeduction == 0){
          totalSalesAmount += item.totalProductAmount;
        }else{
          totalSalesAmount2 += item.totalProductAmount
          totalSalesAmount=totalSalesAmount2-order.couponDeduction
        }
      }
      });
    });

    let totalCouponDeduction=0
    salesReport.forEach(item=>{
      totalCouponDeduction += item.couponDeduction
    })
    let salesCount=0
    salesReport.forEach(item=>{
      salesCount++
    })
    let overAllOrderAmount=0
    salesReport.forEach(item=>{
      overAllOrderAmount+= item.orderAmount
    })

    let totalSalesCount = sc.length;
    let totalPages = Math.ceil(totalSalesCount / perPage);

    

    res.render('admin/salesreport',{salesReport,totalSalesAmount,totalCouponDeduction,
      salesCount,overAllOrderAmount, totalPages,
      currentPage: page}) 
    
  } catch (error) {
    console.log(error.message)
  }
}



const yearlySalesReport= async(req,res)=>{
  try {
    const page = req.query.page || 1; 
    const perPage = 10; 
    const skip = (page - 1) * perPage;

    const currentDate = new Date();
    
    const startOfYear = new Date(currentDate.getFullYear(), 0, 1);
   
    const endOfYear = new Date(currentDate.getFullYear(), 11, 31);

    
    const salesReport = await order.find({
        shippingDate: { $gte: startOfYear, $lte: endOfYear }
    }).sort({_id:-1}).skip(skip)
    .limit(perPage);

    let sc=  await order.find({
      shippingDate: { $gte: startOfYear, $lte: endOfYear }
  }).sort({_id:-1})

    let totalSalesAmount = 0;
    let totalSalesAmount2 = 0;
    
    

    salesReport.forEach(order => {
      order.orderedItem.forEach(item => {
        if (item.productStatus === "Delivered") {
          console.log("order.couponDeduction ::::",order.couponDeduction)
          if(order.couponDeduction == 0){
          totalSalesAmount += item.totalProductAmount;
        }else{
          totalSalesAmount2 += item.totalProductAmount
          totalSalesAmount=totalSalesAmount2-order.couponDeduction
        }
      }
      });
    });

    let totalCouponDeduction=0
    salesReport.forEach(item=>{
      totalCouponDeduction += item.couponDeduction
    })
    let salesCount=0
    salesReport.forEach(item=>{
      salesCount++
    })
    let overAllOrderAmount=0
    salesReport.forEach(item=>{
      overAllOrderAmount+= item.orderAmount
    })

    let totalSalesCount = sc.length;
    const totalPages = Math.ceil(totalSalesCount / perPage);

    res.render('admin/salesreport',{salesReport,totalSalesAmount,totalCouponDeduction,
      salesCount,overAllOrderAmount, totalPages,
      currentPage: page}) 
    
  } catch (error) {
    console.log(error.message)
  }
}



const filterCustomDate= async (req,res)=>{
  try {

    const salesReport= await order.find().populate("orderedItem.productId").populate("deliveryAddress").populate("userId").sort({_id:-1});

    const {startDate, endDate}= req.body
    const adjustedEndDate = new Date(endDate);
        adjustedEndDate.setDate(adjustedEndDate.getDate() + 1);
  
  const filteredSalesReport = salesReport.filter(item => {
    const shippingDate = new Date(item.shippingDate);
    return shippingDate >= new Date(startDate) && shippingDate < adjustedEndDate;
});





res.json({ filteredSalesReport });

  } catch (error) {
    console.log(error.message)
  }
}


const brandManagement= async (req,res)=>{
  try {
    const brandsData= await Brands.find()
 
    res.render('admin/brandlist',{brandsData})
    
  } catch (error) {
    console.log(error.message)
  }
}
const addNewBrand= async (req,res)=>{
  try {
    const {brandName, brandItems}=req.body

    const newBrand= new Brands({
      brandname:brandName,
      brandItems:brandItems,
    })

    await newBrand.save()

    res.json({message:"New Branded Added Successfully"})
    
  } catch (error) {
    console.log(error.message)
  }
}

const downloadSalesReport = async (req, res) => {
  try {
    const { html } = req.body; 
    const browser = await puppeteer.launch();
    const page = await browser.newPage();


    await page.setContent(html);
    const pdfBuffer = await page.pdf();
    await browser.close();
 

    res.setHeader('Content-Type', 'application/pdf');
    res.send(pdfBuffer);
  } catch (error) {
    console.error('Error generating PDF:', error);
    res.status(500).send('Error generating PDF');
  }
}




const graphData = async (req, res) => {
  try {
    const { year, type } = req.body;

    if (type === 'month') {
      
      const salesData = Array(12).fill(0);
      const revenueData = Array(12).fill(0);

     
      const startDate = new Date(year, 0, 1);
      const endDate = new Date(year, 11, 31, 23, 59, 59);
      const allData = await order.find({
        shippingDate: { $gte: startDate, $lte: endDate }
      }).populate("orderedItem.productId").populate("deliveryAddress").populate("userId").sort({_id:-1});

      
      allData.forEach(item => {
        const month = item.shippingDate.getMonth();
        salesData[month] += item.orderAmount;
        if (item.paymentStatus === "Payment Successfull") {
          revenueData[month] += item.orderAmount;
        }
      });

     
      res.json({ labels: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'], salesData, revenueData });
    } else if (type === 'year') {
      if (year === "2024") {
       
        const currentYear = new Date().getFullYear();
        const pastYears = Array.from({ length: 5 }, (_, i) => currentYear - i);
        const salesData = Array(5).fill(0);
        const revenueData = Array(5).fill(0);

       
        for (let i = 0; i < 5; i++) {
          const startDate = new Date(pastYears[i], 0, 1);
          const endDate = new Date(pastYears[i], 11, 31, 23, 59, 59);
          const allData = await order.find({
            shippingDate: { $gte: startDate, $lte: endDate }
          }).populate("orderedItem.productId").populate("deliveryAddress").populate("userId").sort({_id:-1});

          allData.forEach(item => {
            salesData[i] += item.orderAmount;
            if (item.paymentStatus === "Payment Successfull") {
              revenueData[i] += item.orderAmount;
            }
          });
        }

  
        res.json({ labels: pastYears.map(String), salesData, revenueData });
      } else {
        res.status(400).json({ error: 'Invalid year provided.' });
      }
    } else {
      res.status(400).json({ error: 'Invalid type provided.' });
    }
  } catch (error) {
    console.log(error.message);
    res.status(500).json({ error: 'Failed to generate sales report.' });
  }
};


const approveRetrunRequest = async (req, res) => {
  try {
     
    let {text, decision,productId,orderId,userId,totalProductAmount,quantity}= req.body
  

    if(decision==="approve"){
       await order.findOneAndUpdate(
        { _id: orderId, 'orderedItem.productId': productId },
        { $set: { 'orderedItem.$.productStatus': 'Returned' ,
        'orderedItem.$.returnRequest':false} },
        { new: true });

        await User.findByIdAndUpdate(userId, {
        $inc: { wallet: totalProductAmount }, 
        $push: {
            walletHistory: {
                amount: totalProductAmount,
                description: `Refund of ORDERID:${orderId}`,
                date: new Date(),
                status: "credit"
            }
        }
        }, { new: true });

           await Products.findOneAndUpdate(
          { _id: productId },
          { $inc: { productquadity: +quantity } }
        );
  
  
    }else if(decision==="reject"){
      await order.findOneAndUpdate(
        { _id: orderId, 'orderedItem.productId': productId },
        { $set: { 'orderedItem.$.productStatus': 'Return request rejected',
        'orderedItem.$.returnRequest':false} },
        { new: true });

    }
  

       res.json({message :"updated successsfully"})

  } catch (error) {
      console.log(error.message)
      res.status(500).json({ error: 'Failed to generate sales report.' });
  }
}

const deleteOffer= async (req,res)=>{
  try {
    const {offerId}=req.body

    await Offer.findByIdAndDelete({_id:offerId})
    await Products.updateMany(
      { offerId: offerId },
      { $unset: { offerId: "" } }
    );
    res.json({message:"success"})
  } catch (error) {
    console.log(error.message)
  }
}



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
