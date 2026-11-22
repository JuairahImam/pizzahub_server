import { ObjectId } from "mongodb";
import connectDB from "../config/database.js";

export interface MenuBrowseFilters {
  search?: string;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  location?: string;
  sort: "newest" | "price_asc" | "price_desc";
  page: number;
  limit: number;
}

const escapeRegex = (value: string) => {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

const getPublicRestaurant = async (restaurantId: string) => {
  if (!ObjectId.isValid(restaurantId)) {
    return null;
  }

  const db = await connectDB();

  const restaurant = await db.collection("restaurants").findOne(
    { _id: new ObjectId(restaurantId) },
    {
      projection: {
        vendorId: 0,
      },
    }
  );

  return restaurant;
};

export const getAvailableMenuItems = async (
  filters: MenuBrowseFilters
) => {
  const db = await connectDB();

  const menuItems = db.collection("menuItems");

  const query: Record<string, unknown> = {
    isAvailable: true,
    approvalStatus: "APPROVED",
  };

  if (filters.location) {
    const restaurants = await db
      .collection("restaurants")
      .find(
        {
          address: {
            $regex: escapeRegex(filters.location),
            $options: "i",
          },
        },
        { projection: { _id: 1 } }
      )
      .toArray();

    query.restaurantId = {
      $in: restaurants.map((restaurant) => restaurant._id.toString()),
    };
  }

  if (filters.search) {
    query.name = {
      $regex: escapeRegex(filters.search),
      $options: "i",
    };
  }

  if (filters.category) {
    query.category = {
      $regex: `^${escapeRegex(filters.category)}$`,
      $options: "i",
    };
  }

  if (
    filters.minPrice !== undefined ||
    filters.maxPrice !== undefined
  ) {
    const priceFilter: Record<string, number> = {};

    if (filters.minPrice !== undefined) {
      priceFilter.$gte = filters.minPrice;
    }

    if (filters.maxPrice !== undefined) {
      priceFilter.$lte = filters.maxPrice;
    }

    query.price = priceFilter;
  }

  let sortOptions: Record<string, 1 | -1> = {
    createdAt: -1,
  };

  if (filters.sort === "price_asc") {
    sortOptions = { price: 1 };
  } else if (filters.sort === "price_desc") {
    sortOptions = { price: -1 };
  }

  const total = await menuItems.countDocuments(query);

  const items = await menuItems
    .find(query)
    .sort(sortOptions)
    .skip((filters.page - 1) * filters.limit)
    .limit(filters.limit)
    .toArray();

  const restaurantIds = [
    ...new Set(
      items
        .map((item) => item.restaurantId)
        .filter(
          (id): id is string => typeof id === "string"
        )
    ),
  ];

  const validRestaurantIds = restaurantIds
    .filter((id) => ObjectId.isValid(id))
    .map((id) => new ObjectId(id));

  const restaurants = await db
    .collection("restaurants")
    .find(
      { _id: { $in: validRestaurantIds } },
      {
        projection: {
          vendorId: 0,
        },
      }
    )
    .toArray();

  const restaurantMap = new Map(
    restaurants.map((restaurant) => [
      restaurant._id.toString(),
      restaurant,
    ])
  );

  const result = items.map((item) => {
    const {
      vendorId: _vendorId,
      imageId: _imageId,
      ...publicItem
    } = item;

    return {
      ...publicItem,
      restaurant:
        typeof item.restaurantId === "string"
          ? restaurantMap.get(item.restaurantId) ?? null
          : null,
    };
  });

  return {
    menuItems: result,
    pagination: {
      total,
      page: filters.page,
      limit: filters.limit,
      totalPages: Math.ceil(total / filters.limit),
    },
  };
};

export const getAvailableMenuItemById = async (
  itemId: string
) => {
  const db = await connectDB();

  const item = await db.collection("menuItems").findOne({
    _id: new ObjectId(itemId),
    isAvailable: true,
    approvalStatus: "APPROVED",
  });

  if (!item) {
    return null;
  }

  const {
    vendorId: _vendorId,
    imageId: _imageId,
    ...publicItem
  } = item;

  const restaurant =
    typeof item.restaurantId === "string"
      ? await getPublicRestaurant(item.restaurantId)
      : null;

  return {
    ...publicItem,
    restaurant,
  };
};

export const getAvailableCategories = async () => {
  const db = await connectDB();

  const categories = await db
    .collection("menuItems")
    .distinct("category", {
      isAvailable: true,
      approvalStatus: "APPROVED",
    });

  return categories
    .filter(
      (category): category is string =>
        typeof category === "string"
    )
    .sort((a, b) => a.localeCompare(b));
};