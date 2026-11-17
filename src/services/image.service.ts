import type { Express } from "express";

interface ImgBBResponse {
  success: boolean;
  data?: {
    id: string;
    title: string;
    url: string;
    display_url: string;
    size: number;
  };
  error?: {
    message: string;
  };
}

export const uploadImageToImgBB = async (
  file: Express.Multer.File
) => {
  const apiKey = process.env.IMGBB_API_KEY;

  if (!apiKey) {
    throw new Error("IMGBB_API_KEY is not configured.");
  }

  const formData = new FormData();
  formData.append("image", file.buffer.toString("base64"));

  const url = new URL("https://api.imgbb.com/1/upload");
  url.searchParams.set("key", apiKey);

  const response = await fetch(url, {
    method: "POST",
    body: formData,
  });

  const result = (await response.json()) as ImgBBResponse;

  if (!response.ok || !result.success || !result.data) {
    throw new Error(
      result.error?.message || "Image upload to ImgBB failed."
    );
  }

  return {
    id: result.data.id,
    title: result.data.title,
    imageUrl: result.data.url,
    displayUrl: result.data.display_url,
    size: result.data.size,
  };
};