import { ObjectId } from "mongodb";
import connectDB from "../config/database.js";

export type PromoteVendorReason =
  | "NOT_FOUND"
  | "ADMIN_ACCOUNT"
  | "ALREADY_VENDOR"
  | "INVALID_ROLE"
  | "BLOCKED_USER";

export type PromoteVendorResult =
  | { success: true }
  | { success: false; reason: PromoteVendorReason };

export type BlockUserReason = "NOT_FOUND" | "SELF_BLOCK" | "ADMIN_BLOCK";

export type BlockUserResult =
  | { success: true }
  | { success: false; reason: BlockUserReason };

export type UnblockUserReason = "NOT_FOUND" | "ADMIN_ACCOUNT";

export type UnblockUserResult =
  | { success: true }
  | { success: false; reason: UnblockUserReason };

export const promoteUserToVendor = async (
  email: string
): Promise<PromoteVendorResult> => {
  const db = await connectDB();
  const users = db.collection("user");

  const targetUser = await users.findOne({ email });

  if (!targetUser) {
    return { success: false, reason: "NOT_FOUND" };
  }

  if (targetUser.role === "admin") {
    return { success: false, reason: "ADMIN_ACCOUNT" };
  }

  if (targetUser.role === "vendor") {
    return { success: false, reason: "ALREADY_VENDOR" };
  }

  if (targetUser.role !== "customer") {
    return { success: false, reason: "INVALID_ROLE" };
  }

  if (targetUser.isBlocked === true) {
    return { success: false, reason: "BLOCKED_USER" };
  }

  await users.updateOne(
    { _id: targetUser._id },
    {
      $set: {
        role: "vendor",
        updatedAt: new Date(),
      },
    },
  );

  return { success: true };
};

export const getAllVendors = async () => {
  const db = await connectDB();
  const users = db.collection("user");

  return users
    .find(
      { role: "vendor" },
      {
        projection: {
          _id: 0,
          id: 1,
          name: 1,
          email: 1,
          image: 1,
          emailVerified: 1,
          isBlocked: 1,
          createdAt: 1,
          updatedAt: 1,
          role: 1,
        },
      },
    )
    .sort({ createdAt: -1 })
    .toArray();
};

export const blockUser = async (
  targetEmail: string,
  adminId: string
): Promise<BlockUserResult> => {
  const db = await connectDB();
  const users = db.collection("user");

  const targetUser = await users.findOne({
    email: targetEmail,
  });

  if (!targetUser) {
    return { success: false, reason: "NOT_FOUND" };
  }

  if (targetUser.id === adminId || targetUser._id.toString() === adminId) {
    return { success: false, reason: "SELF_BLOCK" };
  }

  if (targetUser.role === "admin") {
    return { success: false, reason: "ADMIN_BLOCK" };
  }

  await users.updateOne(
    { _id: targetUser._id },
    {
      $set: {
        isBlocked: true,
        updatedAt: new Date(),
      },
    },
  );

  return { success: true };
};

export const unblockUser = async (
  targetEmail: string
): Promise<UnblockUserResult> => {
  const db = await connectDB();
  const users = db.collection("user");

  const targetUser = await users.findOne({
    email: targetEmail,
  });

  if (!targetUser) {
    return { success: false, reason: "NOT_FOUND" };
  }

  if (targetUser.role === "admin") {
    return { success: false, reason: "ADMIN_ACCOUNT" };
  }

  await users.updateOne(
    { _id: targetUser._id },
    {
      $set: {
        isBlocked: false,
        updatedAt: new Date(),
      },
    },
  );

  return { success: true };
};

const escapeRegex = (value: string) => {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

export interface AdminMenuFilters {
  status?: string;
  vendorId?: string;
  category?: string;
  q?: string;
  page: number;
  limit: number;
}

const enrichMenuItems = async (items: any[]) => {
  const db = await connectDB();
  const vendorIds = [
    ...new Set(
      items
        .map((item) => item.vendorId)
        .filter((id): id is string => typeof id === "string" && ObjectId.isValid(id))
    ),
  ].map((id) => new ObjectId(id));

  const restaurantIds = [
    ...new Set(
      items
        .map((item) => item.restaurantId)
        .filter((id): id is string => typeof id === "string" && ObjectId.isValid(id))
    ),
  ].map((id) => new ObjectId(id));

  const [vendors, restaurants] = await Promise.all([
    vendorIds.length
      ? db
          .collection("user")
          .find(
            { _id: { $in: vendorIds } },
            {
              projection: {
                name: 1,
                email: 1,
                role: 1,
              },
            }
          )
          .toArray()
      : Promise.resolve([]),
    restaurantIds.length
      ? db
          .collection("restaurants")
          .find(
            { _id: { $in: restaurantIds } },
            {
              projection: {
                name: 1,
                address: 1,
                phone: 1,
              },
            }
          )
          .toArray()
      : Promise.resolve([]),
  ]);

  const vendorMap = new Map(
    vendors.map((vendor) => [vendor._id.toString(), vendor])
  );
  const restaurantMap = new Map(
    restaurants.map((restaurant) => [restaurant._id.toString(), restaurant])
  );

  return items.map((item) => ({
    ...item,
    vendor:
      typeof item.vendorId === "string"
        ? vendorMap.get(item.vendorId)
          ? {
              id: item.vendorId,
              name: vendorMap.get(item.vendorId)?.name,
              email: vendorMap.get(item.vendorId)?.email,
              role: vendorMap.get(item.vendorId)?.role,
            }
          : null
        : null,
    restaurant:
      typeof item.restaurantId === "string"
        ? restaurantMap.get(item.restaurantId) ?? null
        : null,
  }));
};

export const getAdminMenuItems = async (filters: AdminMenuFilters) => {
  const db = await connectDB();
  const menuItems = db.collection("menuItems");

  const query: Record<string, unknown> = {};

  if (filters.status) {
    query.approvalStatus = filters.status;
  }

  if (filters.vendorId) {
    query.vendorId = filters.vendorId;
  }

  if (filters.category) {
    query.category = {
      $regex: `^${escapeRegex(filters.category)}$`,
      $options: "i",
    };
  }

  if (filters.q) {
    query.$or = [
      {
        name: {
          $regex: escapeRegex(filters.q),
          $options: "i",
        },
      },
      {
        description: {
          $regex: escapeRegex(filters.q),
          $options: "i",
        },
      },
    ];
  }

  const total = await menuItems.countDocuments(query);

  const items = await menuItems
    .find(query)
    .sort({ createdAt: -1 })
    .skip((filters.page - 1) * filters.limit)
    .limit(filters.limit)
    .toArray();

  const enrichedItems = await enrichMenuItems(items);

  return {
    menuItems: enrichedItems,
    pagination: {
      total,
      page: filters.page,
      limit: filters.limit,
      totalPages: Math.ceil(total / filters.limit),
    },
  };
};

export const getAdminMenuItemById = async (id: string) => {
  const db = await connectDB();
  const item = await db.collection("menuItems").findOne({
    _id: new ObjectId(id),
  });

  if (!item) {
    return null;
  }

  const enriched = await enrichMenuItems([item]);
  return enriched[0];
};

export const approveMenuItem = async (
  adminId: string,
  id: string
) => {
  const db = await connectDB();
  const menuItems = db.collection("menuItems");

  const existingItem = await menuItems.findOne({
    _id: new ObjectId(id),
  });

  if (!existingItem) {
    return { success: false, reason: "NOT_FOUND" as const };
  }

  await menuItems.updateOne(
    { _id: new ObjectId(id) },
    {
      $set: {
        approvalStatus: "APPROVED",
        rejectionReason: null,
        reviewedAt: new Date(),
        reviewedBy: adminId,
        updatedAt: new Date(),
      },
    }
  );

  const updatedItem = await menuItems.findOne({
    _id: new ObjectId(id),
  });

  const enriched = await enrichMenuItems([updatedItem as any]);
  return {
    success: true as const,
    menuItem: enriched[0],
  };
};

export const rejectMenuItem = async (
  adminId: string,
  id: string,
  rejectionReason: string
) => {
  const db = await connectDB();
  const menuItems = db.collection("menuItems");

  const existingItem = await menuItems.findOne({
    _id: new ObjectId(id),
  });

  if (!existingItem) {
    return { success: false, reason: "NOT_FOUND" as const };
  }

  await menuItems.updateOne(
    { _id: new ObjectId(id) },
    {
      $set: {
        approvalStatus: "REJECTED",
        rejectionReason,
        reviewedAt: new Date(),
        reviewedBy: adminId,
        updatedAt: new Date(),
      },
    }
  );

  const updatedItem = await menuItems.findOne({
    _id: new ObjectId(id),
  });

  const enriched = await enrichMenuItems([updatedItem as any]);
  return {
    success: true as const,
    menuItem: enriched[0],
  };
};

export const getAdminDashboardOverview = async () => {
  const db = await connectDB();
  const users = db.collection("user");
  const menuItems = db.collection("menuItems");
  const orders = db.collection("orders");

  const [
    totalUsers,
    totalCustomers,
    totalVendors,
    blockedUsers,
    totalMenuItems,
    pendingMenuItems,
    approvedMenuItems,
    rejectedMenuItems,
    totalOrders,
    pendingOrders,
    confirmedOrders,
    preparingOrders,
    outForDeliveryOrders,
    deliveredOrders,
    rejectedOrders,
    cancelledOrders,
    deliveredOrderValueResult,
    recentOrders,
    recentMenuItemsRaw,
  ] = await Promise.all([
    users.countDocuments(),
    users.countDocuments({ role: "customer" }),
    users.countDocuments({ role: "vendor" }),
    users.countDocuments({ isBlocked: true }),
    menuItems.countDocuments(),
    menuItems.countDocuments({ approvalStatus: "PENDING" }),
    menuItems.countDocuments({ approvalStatus: "APPROVED" }),
    menuItems.countDocuments({ approvalStatus: "REJECTED" }),
    orders.countDocuments(),
    orders.countDocuments({ status: "PENDING" }),
    orders.countDocuments({ status: "CONFIRMED" }),
    orders.countDocuments({ status: "PREPARING" }),
    orders.countDocuments({ status: "OUT_FOR_DELIVERY" }),
    orders.countDocuments({ status: "DELIVERED" }),
    orders.countDocuments({ status: "REJECTED" }),
    orders.countDocuments({ status: "CANCELLED" }),
    orders
      .aggregate([
        { $match: { status: "DELIVERED" } },
        { $group: { _id: null, total: { $sum: "$totalAmount" } } },
      ])
      .toArray(),
    orders
      .find(
        {},
        {
          projection: {
            _id: 1,
            customerName: 1,
            restaurantName: 1,
            totalAmount: 1,
            status: 1,
            createdAt: 1,
          },
        }
      )
      .sort({ createdAt: -1 })
      .limit(5)
      .toArray(),
    menuItems
      .find(
        {},
        {
          projection: {
            _id: 1,
            name: 1,
            category: 1,
            approvalStatus: 1,
            isAvailable: 1,
            vendorId: 1,
            createdAt: 1,
          },
        }
      )
      .sort({ createdAt: -1 })
      .limit(5)
      .toArray(),
  ]);

  const recentMenuItems = await enrichMenuItems(recentMenuItemsRaw as any[]);

  return {
    users: {
      total: totalUsers,
      customers: totalCustomers,
      vendors: totalVendors,
      blocked: blockedUsers,
    },
    menuItems: {
      total: totalMenuItems,
      pending: pendingMenuItems,
      approved: approvedMenuItems,
      rejected: rejectedMenuItems,
    },
    orders: {
      total: totalOrders,
      pending: pendingOrders,
      confirmed: confirmedOrders,
      preparing: preparingOrders,
      outForDelivery: outForDeliveryOrders,
      delivered: deliveredOrders,
      rejected: rejectedOrders,
      cancelled: cancelledOrders,
      deliveredOrderValue: deliveredOrderValueResult[0]?.total ?? 0,
    },
    recentOrders: recentOrders.map((order: any) => ({
      id: order._id.toString(),
      customerName: order.customerName,
      restaurantName: order.restaurantName,
      totalAmount: order.totalAmount,
      status: order.status,
      createdAt: order.createdAt,
    })),
    recentMenuItems: recentMenuItems.map((item: any) => ({
      id: item._id.toString(),
      name: item.name,
      category: item.category,
      approvalStatus: item.approvalStatus,
      isAvailable: item.isAvailable,
      vendorName: item.vendor?.name ?? null,
      createdAt: item.createdAt,
    })),
  };
};
