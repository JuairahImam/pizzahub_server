import { ObjectId } from "mongodb";
import connectDB from "../config/database.js";

export type VendorRequestStatus = "PENDING" | "APPROVED" | "REJECTED";

type VendorRequestDocument = {
  _id: ObjectId;
  userId: string;
  name: string;
  email: string;
  restaurantName: string;
  message?: string;
  status: VendorRequestStatus;
  createdAt: Date;
  updatedAt: Date;
  reviewedAt?: Date | null;
  reviewedBy?: string | null;
  rejectionReason?: string | null;
};

export type VendorRequest = {
  id: string;
  userId: string;
  name: string;
  email: string;
  restaurantName: string;
  message: string;
  status: VendorRequestStatus;
  createdAt: Date;
  updatedAt: Date;
  reviewedAt: Date | null;
  reviewedBy: string | null;
  rejectionReason: string | null;
};

const serializeRequest = (record: VendorRequestDocument): VendorRequest => ({
  id: record._id.toString(),
  userId: record.userId,
  name: record.name,
  email: record.email,
  restaurantName: record.restaurantName,
  message: record.message ?? "",
  status: record.status,
  createdAt: record.createdAt,
  updatedAt: record.updatedAt,
  reviewedAt: record.reviewedAt ?? null,
  reviewedBy: record.reviewedBy ?? null,
  rejectionReason: record.rejectionReason ?? null,
});

export type CreateVendorRequestReason =
  | "USER_NOT_FOUND"
  | "INVALID_ROLE"
  | "BLOCKED_USER"
  | "PENDING_EXISTS";

export type CreateVendorRequestResult =
  | { success: true; request: VendorRequest }
  | { success: false; reason: CreateVendorRequestReason };

export type ReviewVendorRequestReason =
  | "NOT_FOUND"
  | "ALREADY_REVIEWED"
  | "USER_NOT_FOUND"
  | "INVALID_ROLE"
  | "BLOCKED_USER";

export type ReviewVendorRequestResult =
  | { success: true; request: VendorRequest; roleUpdated: boolean }
  | { success: false; reason: ReviewVendorRequestReason };

/**
 * A signed-in customer asks to become a vendor. The role is never taken from
 * the request body; only an admin can grant it when reviewing this request.
 */
export const createVendorRequest = async (params: {
  userId: string;
  name: string;
  email: string;
  restaurantName: string;
  message: string;
}): Promise<CreateVendorRequestResult> => {
  const db = await connectDB();
  const users = db.collection("user");
  const requests = db.collection("vendorRequests");

  const user = await users.findOne(
    { _id: new ObjectId(params.userId) },
    { projection: { role: 1, isBlocked: 1 } }
  );

  if (!user) {
    return { success: false, reason: "USER_NOT_FOUND" };
  }

  if (user.role !== "customer") {
    return { success: false, reason: "INVALID_ROLE" };
  }

  if (user.isBlocked === true) {
    return { success: false, reason: "BLOCKED_USER" };
  }

  const pendingRequest = await requests.findOne({
    userId: params.userId,
    status: "PENDING",
  });

  if (pendingRequest) {
    return { success: false, reason: "PENDING_EXISTS" };
  }

  const now = new Date();
  const document: VendorRequestDocument = {
    _id: new ObjectId(),
    userId: params.userId,
    name: params.name,
    email: params.email,
    restaurantName: params.restaurantName,
    message: params.message,
    status: "PENDING",
    createdAt: now,
    updatedAt: now,
    reviewedAt: null,
    reviewedBy: null,
    rejectionReason: null,
  };

  await requests.insertOne(document);

  return { success: true, request: serializeRequest(document) };
};

export const getVendorRequestForUser = async (userId: string) => {
  const db = await connectDB();
  const record = (await db
    .collection("vendorRequests")
    .findOne({ userId }, { sort: { createdAt: -1 } })) as VendorRequestDocument | null;

  return record ? serializeRequest(record) : null;
};

const escapeRegex = (value: string) => {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

export interface AdminVendorRequestFilters {
  status?: string;
  q?: string;
  page: number;
  limit: number;
}

export const getVendorRequests = async (filters: AdminVendorRequestFilters) => {
  const db = await connectDB();
  const requests = db.collection("vendorRequests");

  const query: Record<string, unknown> = {};

  if (filters.status) {
    query.status = filters.status;
  }

  if (filters.q) {
    const pattern = escapeRegex(filters.q);
    query.$or = [
      { restaurantName: { $regex: pattern, $options: "i" } },
      { name: { $regex: pattern, $options: "i" } },
      { email: { $regex: pattern, $options: "i" } },
    ];
  }

  const total = await requests.countDocuments(query);
  const documents = (await requests
    .find(query)
    .sort({ createdAt: -1 })
    .skip((filters.page - 1) * filters.limit)
    .limit(filters.limit)
    .toArray()) as VendorRequestDocument[];

  return {
    requests: documents.map(serializeRequest),
    pagination: {
      total,
      page: filters.page,
      limit: filters.limit,
      totalPages: Math.ceil(total / filters.limit),
    },
  };
};

export const getVendorRequestById = async (id: string) => {
  const db = await connectDB();
  const record = (await db
    .collection("vendorRequests")
    .findOne({ _id: new ObjectId(id) })) as VendorRequestDocument | null;

  return record ? serializeRequest(record) : null;
};

/**
 * Approves a pending request and promotes its owner. The role change happens
 * here, in trusted server code, after the admin-authenticated route guard.
 */
export const approveVendorRequest = async (
  adminId: string,
  id: string
): Promise<ReviewVendorRequestResult> => {
  const db = await connectDB();
  const requests = db.collection("vendorRequests");
  const users = db.collection("user");

  const record = (await requests.findOne({
    _id: new ObjectId(id),
  })) as VendorRequestDocument | null;

  if (!record) {
    return { success: false, reason: "NOT_FOUND" };
  }

  if (record.status !== "PENDING") {
    return { success: false, reason: "ALREADY_REVIEWED" };
  }

  const user = await users.findOne(
    { _id: new ObjectId(record.userId) },
    { projection: { role: 1, isBlocked: 1 } }
  );

  if (!user) {
    return { success: false, reason: "USER_NOT_FOUND" };
  }

  if (user.role === "admin") {
    return { success: false, reason: "INVALID_ROLE" };
  }

  if (user.isBlocked === true) {
    return { success: false, reason: "BLOCKED_USER" };
  }

  const now = new Date();
  const claim = await requests.updateOne(
    { _id: record._id, status: "PENDING" },
    {
      $set: {
        status: "APPROVED",
        reviewedAt: now,
        reviewedBy: adminId,
        rejectionReason: null,
        updatedAt: now,
      },
    }
  );

  if (claim.modifiedCount === 0) {
    return { success: false, reason: "ALREADY_REVIEWED" };
  }

  let roleUpdated = false;

  if (user.role !== "vendor") {
    await users.updateOne(
      { _id: new ObjectId(record.userId) },
      { $set: { role: "vendor", updatedAt: now } }
    );
    roleUpdated = true;
  }

  const updated = (await requests.findOne({
    _id: record._id,
  })) as VendorRequestDocument;

  return { success: true, request: serializeRequest(updated), roleUpdated };
};

export const rejectVendorRequest = async (
  adminId: string,
  id: string,
  rejectionReason: string
): Promise<ReviewVendorRequestResult> => {
  const db = await connectDB();
  const requests = db.collection("vendorRequests");

  const record = (await requests.findOne({
    _id: new ObjectId(id),
  })) as VendorRequestDocument | null;

  if (!record) {
    return { success: false, reason: "NOT_FOUND" };
  }

  if (record.status !== "PENDING") {
    return { success: false, reason: "ALREADY_REVIEWED" };
  }

  const now = new Date();
  const result = await requests.updateOne(
    { _id: record._id, status: "PENDING" },
    {
      $set: {
        status: "REJECTED",
        rejectionReason,
        reviewedAt: now,
        reviewedBy: adminId,
        updatedAt: now,
      },
    }
  );

  if (result.modifiedCount === 0) {
    return { success: false, reason: "ALREADY_REVIEWED" };
  }

  const updated = (await requests.findOne({
    _id: record._id,
  })) as VendorRequestDocument;

  return { success: true, request: serializeRequest(updated), roleUpdated: false };
};
