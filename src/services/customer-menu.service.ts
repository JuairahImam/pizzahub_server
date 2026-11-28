import { ObjectId } from "mongodb";
import connectDB from "../config/database.js";

export interface MenuBrowseFilters {
  search?: string;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  location?: string;
  sort: "newest" | "price_asc" | "price_desc" | "premium_first";
  page: number;
  limit: number;
}

const escapeRegex = (value: string) => {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

const isPremiumUser = (user: any) => {
  if (!user || user.isPremium !== true || user.subscriptionStatus !== "ACTIVE") {
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

// Featured placement is based on the vendor's verified subscription state.
const getPremiumVendorMap = async (db: any, vendorIds: string[]) => {
  const ids = [
    ...new Set(vendorIds.filter((id) => ObjectId.isValid(id))),
  ].map((id) => new ObjectId(id));

  if (ids.length === 0) return new Map<string, boolean>();

  const users = await db
    .collection("user")
    .find(
      { _id: { $in: ids } },
      {
        projection: {
          isPremium: 1,
          subscriptionStatus: 1,
          premiumExpiresAt: 1,
        },
      }
    )
    .toArray();

  return new Map(
    users.map((user: any) => [user._id.toString(), isPremiumUser(user)])
  );
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
    const pattern = escapeRegex(filters.location);
    const restaurants = await db
      .collection("restaurants")
      .find(
        {
          address: { $regex: pattern, $options: "i" },
        },
        { projection: { _id: 1 } }
      )
      .toArray();

    // Items can carry their own location; older items fall back to the
    // restaurant address.
    query.$or = [
      {
        restaurantId: {
          $in: restaurants.map((restaurant) => restaurant._id.toString()),
        },
      },
      { location: { $regex: pattern, $options: "i" } },
    ];
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

  let total: number;
  let items: any[];

  if (filters.sort === "premium_first") {
    // Featured placement: Premium vendors first, then newest.
    const allItems = await menuItems.find(query).toArray();
    const premiumMap = await getPremiumVendorMap(
      db,
      allItems.map((item) => item.vendorId)
    );

    allItems.sort((a, b) => {
      const premiumDifference =
        Number(premiumMap.get(b.vendorId) === true) -
        Number(premiumMap.get(a.vendorId) === true);

      if (premiumDifference !== 0) return premiumDifference;

      return (
        new Date(b.createdAt).getTime() -
        new Date(a.createdAt).getTime()
      );
    });

    total = allItems.length;
    items = allItems.slice(
      (filters.page - 1) * filters.limit,
      filters.page * filters.limit
    );
  } else {
    total = await menuItems.countDocuments(query);

    items = await menuItems
      .find(query)
      .sort(sortOptions)
      .skip((filters.page - 1) * filters.limit)
      .limit(filters.limit)
      .toArray();
  }

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

  const premiumMap = await getPremiumVendorMap(
    db,
    items.map((item) => item.vendorId)
  );

  const result = items.map((item) => {
    const {
      vendorId: _vendorId,
      imageId: _imageId,
      ...publicItem
    } = item;

    const restaurant =
      typeof item.restaurantId === "string"
        ? restaurantMap.get(item.restaurantId) ?? null
        : null;

    const location =
      typeof item.location === "string" && item.location.trim().length > 0
        ? item.location
        : restaurant?.address ?? null;

    return {
      ...publicItem,
      // Spec aliases: `itemName` / `status` alongside the existing fields.
      itemName: item.name,
      status: item.approvalStatus,
      location,
      isPremium: premiumMap.get(item.vendorId) === true,
      restaurant,
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

  const premiumMap = await getPremiumVendorMap(db, [item.vendorId]);

  const location =
    typeof item.location === "string" && item.location.trim().length > 0
      ? item.location
      : restaurant?.address ?? null;

  return {
    ...publicItem,
    itemName: item.name,
    status: item.approvalStatus,
    location,
    isPremium: premiumMap.get(item.vendorId) === true,
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