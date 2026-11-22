
import type { Request, Response, NextFunction } from "express";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { ObjectId } from "mongodb";

import connectDB from "../config/database.js";

const issuer = process.env.BETTER_AUTH_URL;

if (!issuer) {
  throw new Error("BETTER_AUTH_URL is not configured");
}

const JWKS = createRemoteJWKSet(
  new URL("/api/auth/jwks", issuer)
);

export const authenticateJWT = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Bearer token is required.",
      });
    }

    const token = authHeader.slice(7).trim();

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Token is missing.",
      });
    }

    const { payload } = await jwtVerify(token, JWKS, {
      issuer,
      audience: issuer,
    });

    const userId = payload.sub;

    if (
      typeof userId !== "string" ||
      !ObjectId.isValid(userId)
    ) {
      return res.status(401).json({
        success: false,
        message: "Invalid user identity in token.",
      });
    }

    const db = await connectDB();

    const user = await db.collection("user").findOne(
      { _id: new ObjectId(userId) },
      {
        projection: {
          name: 1,
          email: 1,
          role: 1,
          isBlocked: 1,
          isPremium: 1,
          subscriptionStatus: 1,
          premiumExpiresAt: 1,
        },
      }
    );

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User account not found.",
      });
    }

    if (user.isBlocked === true) {
      return res.status(403).json({
        success: false,
        message: "Your account has been blocked.",
      });
    }

    if (
      !["customer", "vendor", "admin"].includes(
        user.role as string
      )
    ) {
      return res.status(403).json({
        success: false,
        message: "Invalid user role.",
      });
    }

    res.locals.jwtPayload = payload;

    res.locals.user = {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
      isBlocked: user.isBlocked === true,
      isPremium: user.isPremium === true,
      subscriptionStatus:
        typeof user.subscriptionStatus === "string"
          ? user.subscriptionStatus
          : "FREE",
      premiumExpiresAt: user.premiumExpiresAt ?? null,
    };

    next();
  } catch (error) {
    console.error("JWT authentication error:", error);

    return res.status(401).json({
      success: false,
      message: "Invalid or expired JWT.",
    });
  }
};
