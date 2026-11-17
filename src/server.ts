
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { toNodeHandler } from "better-auth/node";

import connectDB from "./config/database.js";
import { auth } from "./config/auth.js";
import routes from "./routes/index.routes.js";
import stripeWebhookRoutes from "./routes/stripe-webhook.routes.js";

dotenv.config();

const app = express();

// CORS Configuration
app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    credentials: true,
  }),
);

// Better Auth handler MUST come before express.json()
app.all("/api/auth/{*any}", toNodeHandler(auth));

// Stripe Webhook MUST come before express.json()
app.use(
  "/api/stripe",
  express.raw({ type: "application/json" }),
  stripeWebhookRoutes,
);

// JSON Middleware
app.use(express.json());

// Centralized API Routes
app.use("/api", routes);

// Root API
app.get("/", (_req, res) => {
  res.status(200).json({
    success: true,
    message: "Welcome to PizzaHub API!",
  });
});

// Health Check API
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

// Server Configuration
const PORT = process.env.PORT || 5001;

// Start Server
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
