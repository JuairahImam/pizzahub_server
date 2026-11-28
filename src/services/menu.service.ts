import { randomUUID } from "crypto";
import { ObjectId } from "mongodb";
import connectDB from "../config/database.js";

export interface MenuItemInput {
  name: string;
  description: string;
  category: string;
  location: string;
  price: number;
  imageUrl: string;
  imageId: string;
  images?: string[];
  isAvailable?: boolean;
}

const ACTIVE_APPROVAL_STATUSES = ["PENDING", "APPROVED"];

const isPremiumEntitled = (user: any) => {
  if (!user || user.isPremium !== true) {
    return false;
  }

  if (user.subscriptionStatus !== "ACTIVE") {
    return false;
  }

  if (user.premiumExpiresAt) {
    const expiresAt = new Date(user.premiumExpiresAt);

    if (Number.isNaN(expiresAt.getTime()) || expiresAt <= new Date()) {
      return false;
    }
  }

  return true;
};


const acquireVendorMenuLock = async (db: any, vendorId: string) => {
  const locks = db.collection("vendorMenuLocks");
  const lockId = randomUUID();

  await locks.createIndex({ vendorId: 1 }, { unique: true });
  await locks.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });

  let attempts = 0;

  while (attempts < 3000) {
    attempts += 1;

    try {
      await locks.insertOne({
        vendorId,
        lockId,
        expiresAt: new Date(Date.now() + 30000),
      });

      return lockId;
    } catch (error: any) {
      if (error?.code === 11000) {
        const deleted = await locks.deleteOne({
          vendorId,
          expiresAt: { $lt: new Date() },
        });

        if (deleted.deletedCount > 0) {
          continue;
        }

        await new Promise((resolve) => setTimeout(resolve, 10));
        continue;
      }

      throw error;
    }
  }

  throw new Error("Unable to acquire vendor menu lock.");
};

const releaseVendorMenuLock = async (
  db: any,
  vendorId: string,
  lockId: string
) => {
  await db.collection("vendorMenuLocks").deleteOne({
    vendorId,
    lockId,
  });
};

export const createMenuItem = async (
  vendorId: string,
  data: MenuItemInput
) => {
  const db = await connectDB();
  const client = db.client;
  const restaurants = db.collection("restaurants");
  const menuItems = db.collection("menuItems");
  const users = db.collection("user");

  const lockId = await acquireVendorMenuLock(db, vendorId);

  const session = client.startSession();
  let restaurantNotFound = false;
  let limitReached = false;
  let createdItem: any = null;

  try {
    await session.withTransaction(async () => {
      const restaurant = await restaurants.findOne(
        { vendorId },
        { session }
      );

      if (!restaurant) {
        restaurantNotFound = true;
        return;
      }

      const isAvailable = data.isAvailable ?? true;

      if (isAvailable) {
        const user = await users.findOne(
          { _id: new ObjectId(vendorId) },
          { session }
        );

        const premium = isPremiumEntitled(user);

        if (!premium) {
          const activeCount = await menuItems.countDocuments(
            {
              vendorId,
              isAvailable: true,
              approvalStatus: { $in: ACTIVE_APPROVAL_STATUSES },
            },
            { session }
          );

          if (activeCount >= 3) {
            limitReached = true;
            return;
          }
        }
      }

      const now = new Date();

      const menuItem = {
        vendorId,
        restaurantId: restaurant._id.toString(),
        name: data.name,
        description: data.description,
        category: data.category,
        location: data.location,
        price: data.price,
        imageUrl: data.imageUrl,
        imageId: data.imageId,
        images:
          data.images && data.images.length > 0
            ? data.images
            : [data.imageUrl],
        isAvailable,
        approvalStatus: "PENDING",
        rejectionReason: null,
        reviewedAt: null,
        reviewedBy: null,
        createdAt: now,
        updatedAt: now,
      };

      const result = await menuItems.insertOne(menuItem, { session });

      createdItem = {
        ...menuItem,
        _id: result.insertedId,
      };
    });
  } finally {
    await session.endSession();
    await releaseVendorMenuLock(db, vendorId, lockId);
  }

  if (restaurantNotFound) {
    return {
      success: false,
      reason: "RESTAURANT_NOT_FOUND",
    };
  }

  if (limitReached) {
    return {
      success: false,
      reason: "ACTIVE_LIMIT_REACHED",
    };
  }

  return {
    success: true,
    menuItem: createdItem,
  };
};

export const getMyMenuItems = async (vendorId: string) => {
  const db = await connectDB();

  return db
    .collection("menuItems")
    .find({ vendorId })
    .sort({ createdAt: -1 })
    .toArray();
};

export const updateMenuItem = async (
  vendorId: string,
  itemId: string,
  updates: Partial<MenuItemInput>
) => {
  const db = await connectDB();
  const client = db.client;
  const menuItems = db.collection("menuItems");
  const users = db.collection("user");

  const lockId = await acquireVendorMenuLock(db, vendorId);

  const session = client.startSession();
  let notFound = false;
  let limitReached = false;
  let updatedItem: any = null;

  try {
    await session.withTransaction(async () => {
      const existingItem = await menuItems.findOne(
        {
          _id: new ObjectId(itemId),
          vendorId,
        },
        { session }
      );

      if (!existingItem) {
        notFound = true;
        return;
      }

      const contentFields = [
        "name",
        "description",
        "category",
        "location",
        "price",
        "imageUrl",
        "imageId",
        "images",
      ];

      const resetsApproval = contentFields.some((field) =>
        Object.prototype.hasOwnProperty.call(updates, field)
      );

      const nextIsAvailable = Object.prototype.hasOwnProperty.call(
        updates,
        "isAvailable"
      )
        ? updates.isAvailable
        : existingItem.isAvailable;

      const nextApprovalStatus = resetsApproval
        ? "PENDING"
        : existingItem.approvalStatus;

      const wasCounted =
        existingItem.isAvailable === true &&
        ACTIVE_APPROVAL_STATUSES.includes(existingItem.approvalStatus);

      const willBeCounted =
        nextIsAvailable === true &&
        ACTIVE_APPROVAL_STATUSES.includes(nextApprovalStatus);

      if (!wasCounted && willBeCounted) {
        const user = await users.findOne(
          { _id: new ObjectId(vendorId) },
          { session }
        );

        const premium = isPremiumEntitled(user);

        if (!premium) {
          const activeCount = await menuItems.countDocuments(
            {
              vendorId,
              isAvailable: true,
              approvalStatus: { $in: ACTIVE_APPROVAL_STATUSES },
              _id: { $ne: new ObjectId(itemId) },
            },
            { session }
          );

          if (activeCount >= 3) {
            limitReached = true;
            return;
          }
        }
      }

      const setPayload: Record<string, unknown> = {
        ...updates,
        updatedAt: new Date(),
      };

      if (resetsApproval) {
        setPayload.approvalStatus = "PENDING";
        setPayload.rejectionReason = null;
        setPayload.reviewedAt = null;
        setPayload.reviewedBy = null;
      }

      await menuItems.updateOne(
        {
          _id: new ObjectId(itemId),
          vendorId,
        },
        {
          $set: setPayload,
        },
        { session }
      );

      updatedItem = await menuItems.findOne(
        {
          _id: new ObjectId(itemId),
          vendorId,
        },
        { session }
      );
    });
  } finally {
    await session.endSession();
    await releaseVendorMenuLock(db, vendorId, lockId);
  }

  if (notFound) {
    return {
      success: false,
      reason: "NOT_FOUND",
    };
  }

  if (limitReached) {
    return {
      success: false,
      reason: "ACTIVE_LIMIT_REACHED",
    };
  }

  return {
    success: true,
    menuItem: updatedItem,
  };
};

export const deleteMenuItem = async (
  vendorId: string,
  itemId: string
) => {
  const db = await connectDB();
  const menuItems = db.collection("menuItems");

  const result = await menuItems.deleteOne({
    _id: new ObjectId(itemId),
    vendorId,
  });

  if (result.deletedCount === 0) {
    return {
      success: false,
      reason: "NOT_FOUND",
    };
  }

  return {
    success: true,
  };
};
