
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import connectDB from "./config/database.js";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (_req, res) => {
  res.status(200).json({
    success: true,
    message: "Welcome to PizzaHub API!",
  });
});
app.get("/health", async (_req, res) => {
    try {
      const db = await connectDB();
      await db.command({ ping: 1 });
  
      res.status(200).json({
        success: true,
        message: "PizzaHub API is healthy",
        database: "connected",
      });
    } catch {
      res.status(503).json({
        success: false,
        message: "Database connection failed",
        database: "disconnected",
      });
    }
  });

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    await connectDB();

    app.listen(PORT, () => {
      console.log(`PizzaHub server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Server startup failed:", error);
    process.exit(1);
  }
};

startServer();
