const  StatusCodes  = require('../../constants/status.constants');

const adminData = {
  adminEmail: process.env.ADMIN_EMAIL,
  adminPassword: process.env.ADMIN_PASSWORD,
};

const adminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (adminData.adminEmail === email && adminData.adminPassword === password) {
      req.session.admin = adminData;
      return res.redirect("/admindashboard");
    } else {
      return res.status(StatusCodes.UNAUTHORIZED).render("admin/adminlogin", {
        message: "Email or Password is incorrect",
      });
    }
  } catch (error) {
    console.error("Admin login error:", error.message);
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).render("admin/adminlogin", {
      message: "Something went wrong. Please try again later.",
    });
  }
};

const adminLogout = async (req, res) => {
  try {
    req.session.admin = null;
    return res.redirect("/adminlogin");
  } catch (error) {
    console.error("Admin logout error:", error.message);
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).send("Logout failed.");
  }
};

module.exports = {
  adminLogin,
  adminLogout,
};
