const mongoose = require("mongoose");
const colors = require("colors");

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("MongoDB connected successfully".bgYellow.bold);
  } catch (error) {
    console.error("MongoDB connection error:".bgRed.bold, error);
    process.exit(1); 
  }
};

module.exports = connectDB;
