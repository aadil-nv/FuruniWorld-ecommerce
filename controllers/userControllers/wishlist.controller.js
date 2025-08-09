const StatusCodes = require("../../constants/status.constants");
const Cart = require("../../models/cartModel");
const Wishlist = require("../../models/wishlistModel");
require("dotenv").config();

const loadWishliist = async (req, res) => {
  try {
    const userId = req.session.user;
    const wishlistData = await Wishlist.find({ userId }).populate(
      "products.productId"
    );
    const user = req.session.user;
    const cartData = await Cart.find({ userId: user });

    let productcount = 0;
    for (const cart of cartData) {
      productcount += cart.products.length;
    }

    res.render("user/wishlist", { wishlistData, productcount });
  } catch (error) {
    console.log(error.message);
    res
      .status(StatusCodes.INTERNAL_SERVER_ERROR)
      .json({ error: "Server error, please try again" });
  }
};

const addProductInWishlist = async (req, res) => {
  try {
    const { id } = req.body;
    const userId = req.session.user;

    const existingProduct = await Wishlist.findOne({
      userId: req.session.user,
      "products.productId": id,
    });

    if (existingProduct) {
      return res.json({ message: "exists" });
    }
    const wishlists = await Wishlist.findOneAndUpdate(
      { userId: req.session.user },
      {
        $addToSet: {
          products: {
            productId: id,
          },
        },
      },
      { new: true, upsert: true }
    );

    res.json({ message: "success" });
  } catch (error) {
    console.log(error.message);
    res
      .status(StatusCodes.INTERNAL_SERVER_ERROR)
      .json({ error: "Server error, please try again" });
  }
};

const removeWishlistProduct = async (req, res) => {
  try {
    const { productId } = req.body;
    const userId = req.session.user;
    const wishlistData = await Wishlist.find({ userId }).populate(
      "products.productId"
    );

    const wishlist = await Wishlist.findOne({ userId });
    if (!wishlist) {
      return res
        .status(StatusCodes.NOT_FOUND)
        .json({ error: "Wishlist not found" });
    }
    wishlist.products = wishlist.products.filter(
      (product) => product.productId.toString() !== productId
    );
    await wishlist.save();

    res
      .status(StatusCodes.OK)
      .json({ message: "Product removed from wishlist successfully" });
  } catch (error) {
    console.log(error.message);
    res
      .status(StatusCodes.INTERNAL_SERVER_ERROR)
      .json({ error: "Server error, please try again" });
  }
};

module.exports = {
  loadWishliist,
  addProductInWishlist,
  removeWishlistProduct,
};
