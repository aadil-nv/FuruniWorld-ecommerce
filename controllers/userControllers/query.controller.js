const Products = require("../../models/productModel");
const Cart = require("../../models/cartModel");
const Category = require("../../models/categoryModel");
require("dotenv").config();




const sortByPopularity = async (req, res) => {
  try {
    const categoryData= await Category.find().sort({id:-1})
    const productsPerPage = 12;
    let currentPage = parseInt(req.query.page) || 1;
    const totalProducts = await Products.countDocuments();
    
    
    const totalPages = Math.ceil(totalProducts / productsPerPage);
    if (currentPage < 1) {
      currentPage = 1;
    } else if (currentPage > totalPages) {
      currentPage = totalPages;
    }
    const startIndex = (currentPage - 1) * productsPerPage;
    const endIndex = Math.min(startIndex + productsPerPage, totalProducts)
    
    const productData = await Products.find().populate("offerId").sort({ _id: -1 }).skip(startIndex).limit(productsPerPage)

    const user=req.session.user
    const cartData = await Cart.find({ userId: user });

    
    let productcount = 0;
    for (const cart of cartData) {
      productcount += cart.products.length;
    }
  
    res.render("user/shop", { productData,categoryData ,currentPage, totalPages,productcount });
  } catch (error) {
    console.log(error.message);
  }
};


const sortByPriceLowToHigh = async (req, res) => {
  try {
    const categoryData= await Category.find().sort({id:1})
    const productsPerPage = 12;
    let currentPage = parseInt(req.query.page) || 1;
    const totalProducts = await Products.countDocuments();
    const totalPages = Math.ceil(totalProducts / productsPerPage);
    if (currentPage < 1) {
      currentPage = 1;
    } else if (currentPage > totalPages) {
      currentPage = totalPages;
    }
    const startIndex = (currentPage - 1) * productsPerPage;
    const endIndex = Math.min(startIndex + productsPerPage, totalProducts)
    
    const productData = await Products.find().populate("offerId").sort({ productprice: 1 }).skip(startIndex).limit(productsPerPage)

    const user=req.session.user
    const cartData = await Cart.find({ userId: user });

    
    let productcount = 0;
    for (const cart of cartData) {
      productcount += cart.products.length;
    }
    res.render("user/shop", { productData ,categoryData,currentPage, totalPages,productcount});
  } catch (error) {
    console.log(error.message);
  }
};


const sortByPriceHighToLow = async (req, res) => {
  try {
    const categoryData= await Category.find().sort({id:-1})
    const productsPerPage = 12;
    let currentPage = parseInt(req.query.page) || 1;
    const totalProducts = await Products.countDocuments();
    const totalPages = Math.ceil(totalProducts / productsPerPage);
    if (currentPage < 1) {
      currentPage = 1;
    } else if (currentPage > totalPages) {
      currentPage = totalPages;
    }
    const startIndex = (currentPage - 1) * productsPerPage;
    const endIndex = Math.min(startIndex + productsPerPage, totalProducts)
    
    const productData = await Products.find().populate("offerId").sort({ productprice: -1 }).skip(startIndex).limit(productsPerPage)
    const user=req.session.user
    const cartData = await Cart.find({ userId: user });

    
    let productcount = 0;
    for (const cart of cartData) {
      productcount += cart.products.length;
    }
    res.render("user/shop", { productData, categoryData,currentPage, totalPages,productcount});
  } catch (error) {
    console.log(error.message);
  }
};

const sortByAtoZ = async (req, res) => {
  try {
    const categoryData= await Category.find().sort({id:1})
    const productsPerPage = 12;
    let currentPage = parseInt(req.query.page) || 1;
    const totalProducts = await Products.countDocuments();
    const totalPages = Math.ceil(totalProducts / productsPerPage);
    if (currentPage < 1) {
      currentPage = 1;
    } else if (currentPage > totalPages) {
      currentPage = totalPages;
    }
    const startIndex = (currentPage - 1) * productsPerPage;
    const endIndex = Math.min(startIndex + productsPerPage, totalProducts)
    
    const productData = await Products.find().populate("offerId").sort({ productname: 1 }).skip(startIndex).limit(productsPerPage)
    const user=req.session.user
    const cartData = await Cart.find({ userId: user });

    
    let productcount = 0;
    for (const cart of cartData) {
      productcount += cart.products.length;
    }
    res.render("user/shop", { productData, categoryData,currentPage, totalPages,productcount});
  } catch (error) {
    console.log(error.message);
  }
};

const sortByZtoA = async (req, res) => {
  try {
    const categoryData= await Category.find().sort({id:-1})
    const productsPerPage = 12;
    let currentPage = parseInt(req.query.page) || 1;
    const totalProducts = await Products.countDocuments();
    const totalPages = Math.ceil(totalProducts / productsPerPage);
    if (currentPage < 1) {
      currentPage = 1;
    } else if (currentPage > totalPages) {
      currentPage = totalPages;
    }
    const startIndex = (currentPage - 1) * productsPerPage;
    const endIndex = Math.min(startIndex + productsPerPage, totalProducts)
    
    const productData = await Products.find().populate("offerId").sort({ productname: -1 }).skip(startIndex).limit(productsPerPage)
    const user=req.session.user
    const cartData = await Cart.find({ userId: user });

    
    let productcount = 0;
    for (const cart of cartData) {
      productcount += cart.products.length;
    }
    res.render("user/shop", { productData,categoryData,currentPage, totalPages,productcount });
  } catch (error) {
    console.log(error.message);
  }
};

const userSearch= async (req,res)=>{
  try {
  const productData= await Products.find().populate("offerId");
  const{search}=req.body

  const matchingProducts = productData.filter(product =>
    product.productname.toLowerCase().includes(search.toLowerCase())
);

   res.json({result :matchingProducts})
  } catch (error) {
    console.log(error.message)
  }
}

const searchCategoryName= async (req,res)=>{
  try {
    const {category}= req.body
    const productData= await Products.find({categoryId:category}).populate("offerId").sort({_id:-1})
   
    res.json({result :productData})
  } catch (error) {
    console.log(error.message)
  }
}

module.exports={
    sortByPopularity,
    sortByPriceLowToHigh,
    sortByPriceHighToLow,
    sortByAtoZ,
    sortByZtoA,
    searchCategoryName,
    userSearch
}