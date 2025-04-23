const User = require("../../models/userModel");




const adminUsersList = async (req, res) => {
  try {
      const perPage = 5;
      const page = req.query.page || 1;

      const user = await User.find()
       .sort({ _id: -1 })
       .skip((perPage * page) - perPage)
       .limit(perPage);
      
      const count = await User.countDocuments();

      res.render("admin/userslist", {
          user,
          currentPage: page,
          totalPages: Math.ceil(count / perPage)
      });
  } catch (error) {
      console.log(error.message);
  }
};

const blockUser = async (req, res) => {
  try {
    const id = req.query.id;
    const user = await User.findById(id);
    if (user.is_blocked == true) {
      await User.updateOne({ _id: id }, { is_blocked: false });
    } else {
      await User.updateOne({ _id: id }, { is_blocked: true });
    }
    res.redirect("userslist");
  } catch (error) {
    console.log(error.message);
  }
};


module.exports ={
    adminUsersList,
    blockUser
}