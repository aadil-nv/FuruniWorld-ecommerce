const isLogin = async (req, res, next) => {
    try {
        if (req.session && req.session.admin) {
            console.log("nextttttttttttttttttttttttttttttttttttttttttt");
            
            return next()
        } else {
            return res.redirect("/adminlogin");
        }
    } catch (error) {
        console.error("isLogin middleware error:", error.message);
        res.status(500).send("Internal Server Error");
    }
};

const isLogout = async (req, res, next) => {
    try {
        if (!req.session || !req.session.admin) {
            return next();
        } else {
            return res.redirect("/admindashboard");
        }
    } catch (error) {
        console.error("isLogout middleware error:", error.message);
        res.status(500).send("Internal Server Error");
    }
};

module.exports = {
    isLogin,
    isLogout
};
