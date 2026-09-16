const mongoose = require("mongoose");

const connectDB = async () => {
    if (!process.env.MONGODB_URI) {
        return;
    }
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log("✅ MongoDB Connected Successfully");
    } catch (error) {
        console.error("❌ MongoDB Connection Failed:", error.message);
    }
};

module.exports = connectDB;