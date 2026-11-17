import type { Request, Response } from "express";
import { uploadImageToImgBB } from "../services/image.service.js";

export const uploadMenuImageController = async (
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

    const image = await uploadImageToImgBB(req.file);

    return res.status(201).json({
      success: true,
      message: "Image uploaded successfully.",
      image,
    });
  } catch (error) {
    console.error("Image upload error:", error);

    return res.status(502).json({
      success: false,
      message: "Failed to upload image. Please try again.",
    });
  }
};