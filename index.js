require("dotenv").config();
const mongoose = require("mongoose");
const express = require("express");
const session = require("express-session");
const flash = require("express-flash");
const path = require("path");
const passport = require("passport");
const nocache = require("nocache");

const userRoute = require("./routes/userRoutes/user.route");
const adminRoute = require("./routes/adminRoutes/admin.route");
const userAuthRoute = require('./routes/userRoutes/user.auth.routes');
const queryRoute = require("./routes/userRoutes/query.route");
const cartRoute = require("./routes/userRoutes/cart.route");
const wishListRoute = require('./routes/userRoutes/wishlist.route');
const orderRoute = require("./routes/userRoutes/order.route");
const productRoute = require("./routes/userRoutes/product.route");
const adminAuthRoute = require("./routes/adminRoutes/admin.auth.route");
const adminUserRoute = require("./routes/adminRoutes/admin.user.route");
const adminProductRoute = require("./routes/adminRoutes/admin.product.route");
const adminCategoryRoute = require("./routes/adminRoutes/admin.category.route");

require("./middleware/passport");

const app = express();

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI)
  .then(data => console.log('MongoDB Connected:', data.connection.host))
  .catch(err => console.error('MongoDB Error:', err));

// Session Setup
app.use(session({
  secret: process.env.SESSION_SECRET || "defaultSecret",
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // set to true in production with HTTPS
    maxAge: 1000 * 60 * 60 * 24 // 1 day
  }
}));

// Middlewares
app.use(flash());
app.set("view engine", "ejs");
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

app.use(passport.initialize());
app.use(passport.session());
app.use(nocache());

// Routes
app.use("/", userRoute);
app.use("/auth", userAuthRoute);
app.use("/", adminRoute);
app.use("/query", queryRoute);
app.use("/cart", cartRoute);
app.use("/wishlist", wishListRoute);
app.use("/order", orderRoute);
app.use("/product", productRoute);
app.use("/admin-auth", adminAuthRoute);
app.use("/admin-user",adminUserRoute)
app.use("/admin-product",adminProductRoute)
app.use("/admin-category",adminCategoryRoute)

// Admin login route
app.get("/adminlogin", (req, res) => {
  if (req.session.admin) {
    return res.redirect('/admindashboard');
  } else {
    res.render("admin/adminlogin");
  }
});

// Catch-all 404
app.get("*", (req, res) => {
  res.render("user/error404");
});

// Start server
const PORT = process.env.PORT || 7777;
app.listen(PORT, () => {
  console.log(`Server started on http://localhost:${PORT}`);
});
