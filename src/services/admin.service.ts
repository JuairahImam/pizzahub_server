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
