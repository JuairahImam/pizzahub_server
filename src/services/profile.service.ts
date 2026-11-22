import { ObjectId } from "mongodb";
import connectDB from "../config/database.js";
import { uploadImageToImgBB } from "./image.service.js";

export const getMyProfile = async (userId: string) => {
  const db = await connectDB();

  return db.collection("user").findOne(
    { _id: new ObjectId(userId) },
    {
      projection: {
        name: 1,
        email: 1,
        role: 1,
        image: 1,
        createdAt: 1,
        updatedAt: 1,
      },
    }
  );
};

export const uploadProfileImage = async (
  userId: string,
  file: Express.Multer.File
) => {
  const db = await connectDB();
  const users = db.collection("user");
  const existingUser = await users.findOne({ _id: new ObjectId(userId) });

  if (!existingUser) {
    return null;
  }

  const image = await uploadImageToImgBB(file);

  await users.updateOne(
    { _id: new ObjectId(userId) },
    {
      $set: {
        image: image.imageUrl,
        updatedAt: new Date(),
      },
    },
  );

  return {
    success: true,
    user: await users.findOne(
      { _id: new ObjectId(userId) },
      {
        projection: {
          name: 1,
          email: 1,
          role: 1,
          image: 1,
          createdAt: 1,
          updatedAt: 1,
        },
      },
    ),
    image,
  };
};

export const updateMyProfile = async (
  userId: string,
  data: { name?: string }
) => {
  const db = await connectDB();
  const users = db.collection("user");

  const existingUser = await users.findOne({
    _id: new ObjectId(userId),
  });

  if (!existingUser) {
    return null;
  }

  await users.updateOne(
    { _id: new ObjectId(userId) },
    {
      $set: {
        ...(data.name ? { name: data.name } : {}),
        updatedAt: new Date(),
      },
    }
  );

  return users.findOne(
    { _id: new ObjectId(userId) },
    {
      projection: {
        name: 1,
        email: 1,
        role: 1,
        createdAt: 1,
        updatedAt: 1,
      },
    }
  );
};
