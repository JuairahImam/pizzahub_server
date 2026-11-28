import { ObjectId } from "mongodb";
import connectDB from "../config/database.js";
import { uploadImageToImgBB } from "./image.service.js";

const PROFILE_PROJECTION = {
  name: 1,
  email: 1,
  role: 1,
  image: 1,
  isBlocked: 1,
  isPremium: 1,
  subscriptionStatus: 1,
  premiumExpiresAt: 1,
  createdAt: 1,
  updatedAt: 1,
};

// Expose assignment-style field names alongside the existing ones without
// renaming stored Better Auth fields.
const withProfileAliases = async (db: any, user: any) => {
  if (!user) return user;

  const restaurant =
    user.role === "vendor"
      ? await db
          .collection("restaurants")
          .findOne(
            { vendorId: user._id.toString() },
            { projection: { name: 1 } }
          )
      : null;

  const premium =
    user.isPremium === true && user.subscriptionStatus === "ACTIVE";

  return {
    ...user,
    isBlocked: user.isBlocked ?? false,
    subscriptionPlan: premium ? "premium" : "free",
    subscriptionExpiresAt: user.premiumExpiresAt ?? null,
    businessName: restaurant?.name ?? null,
  };
};

export const getMyProfile = async (userId: string) => {
  const db = await connectDB();

  const user = await db.collection("user").findOne(
    { _id: new ObjectId(userId) },
    { projection: PROFILE_PROJECTION }
  );

  return withProfileAliases(db, user);
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
    user: await withProfileAliases(
      db,
      await users.findOne(
        { _id: new ObjectId(userId) },
        { projection: PROFILE_PROJECTION }
      )
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

  return withProfileAliases(
    db,
    await users.findOne(
      { _id: new ObjectId(userId) },
      { projection: PROFILE_PROJECTION }
    )
  );
};
