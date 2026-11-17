import { ObjectId } from "mongodb";
import connectDB from "../config/database.js";

export interface MenuItemInput {
  name: string;
  description: string;
  category: string;
  price: number;
  imageUrl: string;
  imageId: string;
  isAvailable?: boolean;
}

export const createMenuItem = async (
  vendorId: string,
  data: MenuItemInput
) => {
  const db = await connectDB();

  const restaurants = db.collection("restaurants");
  const menuItems = db.collection("menuItems");

  // Find the vendor's own restaurant
  const restaurant = await restaurants.findOne({ vendorId });

  if (!restaurant) {
    return {
      success: false,
      reason: "RESTAURANT_NOT_FOUND",
    };
  }

  const now = new Date();

  const menuItem = {
    vendorId,
    restaurantId: restaurant._id.toString(),
    name: data.name,
    description: data.description,
    category: data.category,
    price: data.price,
    imageUrl: data.imageUrl,
    imageId: data.imageId,
    isAvailable: data.isAvailable ?? true,
    createdAt: now,
    updatedAt: now,
  };

  const result = await menuItems.insertOne(menuItem);

  return {
    success: true,
    menuItem: {
      ...menuItem,
      _id: result.insertedId,
    },
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
  const menuItems = db.collection("menuItems");

  const existingItem = await menuItems.findOne({
    _id: new ObjectId(itemId),
    vendorId,
  });

  if (!existingItem) {
    return {
      success: false,
      reason: "NOT_FOUND",
    };
  }

  await menuItems.updateOne(
    {
      _id: new ObjectId(itemId),
      vendorId,
    },
    {
      $set: {
        ...updates,
        updatedAt: new Date(),
      },
    }
  );

  const updatedItem = await menuItems.findOne({
    _id: new ObjectId(itemId),
    vendorId,
  });

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