    const express = require("express");
    const admin_route = express();
    const bodyParser = require("body-parser");
    const admincontroller = require("../../controllers/adminControllers/admin.controller");
    const multer=require('multer')
    const adminAuth = require("../../middleware/adminAuth");
    const upload = require("../../middleware/multer"); 



    admin_route.use(bodyParser.json());
    admin_route.use(bodyParser.urlencoded({ extended: true }));

    

    admin_route.get('/admindashboard',adminAuth.isLogin,admincontroller.adminDashboard)


    admin_route.get('/orderslist',adminAuth.isLogin,admincontroller.adminOrdersList)
    admin_route.get('/orderdetiles/:id',adminAuth.isLogin,admincontroller.adminOrderDetiles)
    admin_route.post('/orderdetiles/:id',adminAuth.isLogin,admincontroller.adminChangeOrderStatus)
    admin_route.post('/admin/approvereturnrequest',adminAuth.isLogin,admincontroller.approveRetrunRequest)


    admin_route.get('/admin/couponlist',adminAuth.isLogin,admincontroller.admincouponlist)
    admin_route.get('/admin/createcoupon',adminAuth.isLogin,admincontroller.admincouponmanagement)
    admin_route.post('/admin/createcoupon',adminAuth.isLogin,admincontroller.addNewCoupon)
    admin_route.post('/admin/deletecoupon',admincontroller.deleteCoupon)



    admin_route.get('/admin/offerlist',adminAuth.isLogin,admincontroller.adminOfferList)
    admin_route.get('/admin/createoffer',adminAuth.isLogin,admincontroller.createCoupon)
    admin_route.post('/admin/createoffer',adminAuth.isLogin,admincontroller.addNewOffer)
    admin_route.post('/admin/selectoffertype',adminAuth.isLogin,admincontroller.selectOfferType)
    admin_route.post('/admin/deleteoffer',adminAuth.isLogin,admincontroller.deleteOffer)



    admin_route.get('/admin/salesreports',adminAuth.isLogin,admincontroller.totalSalesReport)
    admin_route.get('/admin/dailysalesreport',adminAuth.isLogin,admincontroller.dailySalesReport)
    admin_route.get('/admin/weeklysalesreport',adminAuth.isLogin,admincontroller.weeklySalesReport)
    admin_route.get('/admin/monthlysalesreport',adminAuth.isLogin,admincontroller.monthlySalesReport)
    admin_route.get('/admin/yearlysalesreport',adminAuth.isLogin,admincontroller.yearlySalesReport)
    admin_route.post('/admin/filtercustomdate',adminAuth.isLogin,admincontroller.filterCustomDate)
    admin_route.post('/generate-pdf',adminAuth.isLogin,admincontroller.downloadSalesReport)
    admin_route.post('/admin/graphdata',adminAuth.isLogin,admincontroller.graphData)



    admin_route.get('/admin/brandsmanagement',adminAuth.isLogin,admincontroller.brandManagement)
    admin_route.post('/admin/brandsmanagement',adminAuth.isLogin,admincontroller.addNewBrand)



    module.exports = admin_route;