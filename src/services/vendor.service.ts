
import connectDB from "../config/database.js";

export interface RestaurantInput {
  name: string;
  description: string;
  address: string;
  phone: string;
}

export const createRestaurant = async (
  vendorId: string,
  data: RestaurantInput
) => {
  const db = await connectDB();
  const restaurants = db.collection("restaurants");

  // One restaurant per vendor
  await restaurants.createIndex(
    { vendorId: 1 },
    { unique: true }
  );

  const existingRestaurant = await restaurants.findOne({ vendorId });

  if (existingRestaurant) {
    return { success: false, reason: "ALREADY_EXISTS" };
  }

  const now = new Date();

  const restaurant = {
    vendorId,
    name: data.name,
    description: data.description,
    address: data.address,
    phone: data.phone,
    createdAt: now,
    updatedAt: now,
  };

  const result = await restaurants.insertOne(restaurant);

  return {
    success: true,
    restaurant: {
      ...restaurant,
      _id: result.insertedId,
    },
  };
};

export const getMyRestaurant = async (vendorId: string) => {
  const db = await connectDB();

  return db.collection("restaurants").findOne({ vendorId });
};

export const updateRestaurant = async (
  vendorId: string,
  data: Partial<RestaurantInput>
) => {
  const db = await connectDB();
  const restaurants = db.collection("restaurants");

  const existingRestaurant = await restaurants.findOne({ vendorId });

  if (!existingRestaurant) {
    return { success: false, reason: "NOT_FOUND" };
  }

  await restaurants.updateOne(
    { vendorId },
    {
      $set: {
        ...data,
        updatedAt: new Date(),
      },
    }
  );

  const updatedRestaurant = await restaurants.findOne({ vendorId });

  return {
    success: true,
    restaurant: updatedRestaurant,
  };
};
