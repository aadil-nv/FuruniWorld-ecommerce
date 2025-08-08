const StatusCodes = require("../../constants/status.constants");
const User = require("../../models/userModel");

const adminUsersList = async (req, res) => {
  try {
    const perPage = 5;
    const page = req.query.page || 1;

    const user = await User.find()
      .sort({ _id: -1 })
      .skip(perPage * page - perPage)
      .limit(perPage);

    const count = await User.countDocuments();

    res.status(StatusCodes.OK).render("admin/userslist", {
      user,
      currentPage: page,
      totalPages: Math.ceil(count / perPage),
    });
  } catch (error) {
    console.log(error.message);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).send("Internal Server Error");
  }
};

const blockUser = async (req, res) => {
  try {
    const { userId } = req.body;
    const user = await User.findById(userId);

    if (!user) {
      return res
        .status(StatusCodes.NOT_FOUND)
        .json({ success: false, message: "User not found" });
    }

    const newStatus = !user.is_blocked;
    await User.updateOne({ _id: userId }, { is_blocked: newStatus });

    return res.status(StatusCodes.OK).json({
      success: true,
      is_blocked: newStatus,
      message: newStatus
        ? "User blocked successfully"
        : "User unblocked successfully",
    });
  } catch (error) {
    console.error("Error in blockUser:", error.message);
    return res
      .status(StatusCodes.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: "Server error, please try again" });
  }
};

  const searchUser = async (req, res) => {
    console.log("searchUser is calling=============>");
    
    try {
      const perPage = 5;
      const page = req.query.page || 1;
      const { search } = req.body;
      console.log("search", search);
      

      // Build the query object for searching by name
      const query = search
        ? { name: { $regex: search, $options: 'i' } } // Case-insensitive search
        : {};

      // Fetch users with pagination and search filter
      const user = await User.find(query)
        .sort({ _id: -1 })
        .skip(perPage * page - perPage)
        .limit(perPage);

      // Count total users matching the search query
      const count = await User.countDocuments(query);

      // Render the userslist view with the filtered data

      console.log("user", user);
      console.log("count", count);
      console.log("search", search);
      console.log("perPage", perPage);
      
      
      res.json( {
        user,
        currentPage: page,
        totalPages: Math.ceil(count / perPage),
        searchQuery: search || '', 
      });
    } catch (error) {
      console.log(error.message);
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).send("Internal Server Error");
    }
  };

module.exports = {
  adminUsersList,
  blockUser,
  searchUser
};
