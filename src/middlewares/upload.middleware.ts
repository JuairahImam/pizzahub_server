import multer from "multer";
import type { Request, Response, NextFunction } from "express";

const allowedMimeTypes = [
  "image/jpeg",
  "image/png",
  "image/webp",
];

const upload = multer({
  storage: multer.memoryStorage(),

  limits: {
    fileSize: 5 * 1024 * 1024,
  },

  fileFilter: (_req, file, callback) => {
    if (!allowedMimeTypes.includes(file.mimetype)) {
      return callback(
        new Error("Only JPG, JPEG, PNG and WEBP images are allowed.")
      );
    }

    callback(null, true);
  },
});

export const uploadMenuImage = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  upload.single("image")(req, res, (error) => {
    if (error instanceof multer.MulterError) {
      return res.status(400).json({
        success: false,
        message:
          error.code === "LIMIT_FILE_SIZE"
            ? "Image size must not exceed 5 MB."
            : error.message,
      });
    }

    if (error) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    next();
  });
};