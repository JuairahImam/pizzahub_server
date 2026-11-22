import type { Request, Response } from "express";
import type { Express } from "express";
import { ObjectId } from "mongodb";

import {
  getMyProfile,
  updateMyProfile,
  uploadProfileImage,
} from "../services/profile.service.js";

const allowedUpdateFields = ["name"];

const privilegedFields = [
  "role",
  "isAdmin",
  "isPremium",
  "subscriptionStatus",
  "premiumExpiresAt",
  "stripeCustomerId",
  "stripeSubscriptionId",
  "isBlocked",
  "emailVerified",
];

export const getMyProfileController = async (
  req: Request,
  res: Response
) => {
  try {
    const user = await getMyProfile(res.locals.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User profile not found.",
      });
    }

    return res.status(200).json({
      success: true,
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    });
  } catch (error) {
    console.error("Get profile error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve profile.",
    });
  }
};

export const updateMyProfileController = async (
  req: Request,
  res: Response
) => {
  try {
    const body = req.body ?? {};

    if (
      privilegedFields.some((field) => body[field] !== undefined)
    ) {
      return res.status(400).json({
        success: false,
        message: "Privileged fields cannot be modified.",
      });
    }

    if (body.email !== undefined) {
      return res.status(400).json({
        success: false,
        message: "Email cannot be changed.",
      });
    }

    const updates: { name?: string } = {};

    if (body.name !== undefined) {
      if (
        typeof body.name !== "string" ||
        body.name.trim().length === 0
      ) {
        return res.status(400).json({
          success: false,
          message: "Name must be a non-empty string.",
        });
      }

      updates.name = body.name.trim();
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        message: "At least one valid field is required.",
      });
    }

    const user = await updateMyProfile(
      res.locals.user.id,
      updates
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User profile not found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Profile updated successfully.",
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    });
  } catch (error) {
    console.error("Update profile error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update profile.",
    });
  }
};


export const uploadMyProfileImageController = async (
  req: Request,
  res: Response
) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Please select an image to upload.",
      });
    }

    const result = await uploadProfileImage(res.locals.user.id, req.file);

    if (!result?.user) {
      return res.status(404).json({
        success: false,
        message: "User profile not found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Profile image uploaded successfully.",
      image: result.image,
      user: {
        id: result.user._id.toString(),
        name: result.user.name,
        email: result.user.email,
        role: result.user.role,
        image: result.user.image ?? result.image.imageUrl,
        createdAt: result.user.createdAt,
        updatedAt: result.user.updatedAt,
      },
    });
  } catch (error) {
    console.error("Upload profile image error:", error);
    return res.status(502).json({
      success: false,
      message: "Failed to upload profile image. Please try again.",
    });
  }
};
