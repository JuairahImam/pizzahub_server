
import { ObjectId } from "mongodb";
import connectDB from "../config/database.js";

export interface OrderItemInput {
  menuItemId: string;
  quantity: number;
}

export interface CreateOrderInput {
  items: OrderItemInput[];
  deliveryAddress: string;
  contactPhone: string;
}

// CUSTOMER: CREATE ORDER
export const createOrder = async (
  customer: {
    id: string;
    name: string;
    email: string;
  },
  data: CreateOrderInput
) => {
  const db = await connectDB();

  const menuItemsCollection = db.collection("menuItems");
  const restaurantsCollection = db.collection("restaurants");
  const ordersCollection = db.collection("orders");

  const itemIds = data.items.map((item) => item.menuItemId);

  if (
    itemIds.some((id) => !ObjectId.isValid(id)) ||
    new Set(itemIds).size !== itemIds.length
  ) {
    return { success: false as const, reason: "INVALID_ITEMS" };
  }

  const menuItems = await menuItemsCollection
    .find({
      _id: { $in: itemIds.map((id) => new ObjectId(id)) },
      isAvailable: true,
    })
    .toArray();

  if (menuItems.length !== data.items.length) {
    return { success: false as const, reason: "ITEMS_UNAVAILABLE" };
  }

  const restaurantIds = [
    ...new Set(menuItems.map((item) => item.restaurantId)),
  ];

  if (
    restaurantIds.length !== 1 ||
    typeof restaurantIds[0] !== "string" ||
    !ObjectId.isValid(restaurantIds[0])
  ) {
    return { success: false as const, reason: "MULTIPLE_RESTAURANTS" };
  }

  const restaurantId = restaurantIds[0];

  const restaurant = await restaurantsCollection.findOne({
    _id: new ObjectId(restaurantId),
  });

  if (!restaurant) {
    return { success: false as const, reason: "RESTAURANT_NOT_FOUND" };
  }

  const menuItemMap = new Map(
    menuItems.map((item) => [item._id.toString(), item])
  );

  const orderItems = data.items.map((inputItem) => {
    const menuItem = menuItemMap.get(inputItem.menuItemId)!;
    const subtotal = menuItem.price * inputItem.quantity;

    return {
      menuItemId: menuItem._id.toString(),
      name: menuItem.name,
      price: menuItem.price,
      quantity: inputItem.quantity,
      subtotal,
    };
  });

  const totalAmount = orderItems.reduce(
    (total, item) => total + item.subtotal,
    0
  );

  const now = new Date();

  const order = {
    customerId: customer.id,
    customerName: customer.name,
    customerEmail: customer.email,
    vendorId: restaurant.vendorId,
    restaurantId,
    restaurantName: restaurant.name,
    items: orderItems,
    totalAmount,
    deliveryAddress: data.deliveryAddress,
    contactPhone: data.contactPhone,
    status: "PENDING",
    rejectionReason: null,
    createdAt: now,
    updatedAt: now,
  };

  const result = await ordersCollection.insertOne(order);

  return {
    success: true as const,
    order: { ...order, _id: result.insertedId },
  };
};

// CUSTOMER: GET MY ORDERS
export const getMyOrders = async (customerId: string) => {
  const db = await connectDB();

  return db
    .collection("orders")
    .find({ customerId })
    .sort({ createdAt: -1 })
    .toArray();
};

// CUSTOMER: GET SINGLE ORDER
export const getMyOrderById = async (
  customerId: string,
  orderId: string
) => {
  const db = await connectDB();

  return db.collection("orders").findOne({
    _id: new ObjectId(orderId),
    customerId,
  });
};

// CUSTOMER: CANCEL PENDING ORDER
export const cancelMyOrder = async (
  customerId: string,
  orderId: string
) => {
  const db = await connectDB();
  const orders = db.collection("orders");

  const existingOrder = await orders.findOne({
    _id: new ObjectId(orderId),
    customerId,
  });

  if (!existingOrder) {
    return { success: false as const, reason: "NOT_FOUND" };
  }

  if (existingOrder.status !== "PENDING") {
    return { success: false as const, reason: "NOT_CANCELLABLE" };
  }

  const result = await orders.updateOne(
    {
      _id: new ObjectId(orderId),
      customerId,
      status: "PENDING",
    },
    {
      $set: {
        status: "CANCELLED",
        updatedAt: new Date(),
      },
    }
  );

  if (result.modifiedCount === 0) {
    return { success: false as const, reason: "NOT_CANCELLABLE" };
  }

  const cancelledOrder = await orders.findOne({
    _id: new ObjectId(orderId),
    customerId,
  });

  return {
    success: true as const,
    order: cancelledOrder,
  };
};

// VENDOR: GET ALL MY ORDERS
export const getVendorOrders = async (vendorId: string) => {
  const db = await connectDB();

  return db
    .collection("orders")
    .find({ vendorId })
    .sort({ createdAt: -1 })
    .toArray();
};

// VENDOR: ACCEPT ORDER
export const acceptVendorOrder = async (
  vendorId: string,
  orderId: string
) => {
  const db = await connectDB();
  const orders = db.collection("orders");

  const result = await orders.updateOne(
    {
      _id: new ObjectId(orderId),
      vendorId,
      status: "PENDING",
    },
    {
      $set: {
        status: "CONFIRMED",
        updatedAt: new Date(),
      },
    }
  );

  if (result.modifiedCount === 0) {
    const order = await orders.findOne({
      _id: new ObjectId(orderId),
      vendorId,
    });

    if (!order) {
      return { success: false as const, reason: "NOT_FOUND" };
    }

    return { success: false as const, reason: "INVALID_STATUS" };
  }

  const order = await orders.findOne({
    _id: new ObjectId(orderId),
    vendorId,
  });

  return { success: true as const, order };
};

// VENDOR: REJECT ORDER
export const rejectVendorOrder = async (
  vendorId: string,
  orderId: string,
  rejectionReason: string
) => {
  const db = await connectDB();
  const orders = db.collection("orders");

  const result = await orders.updateOne(
    {
      _id: new ObjectId(orderId),
      vendorId,
      status: "PENDING",
    },
    {
      $set: {
        status: "REJECTED",
        rejectionReason,
        updatedAt: new Date(),
      },
    }
  );

  if (result.modifiedCount === 0) {
    const order = await orders.findOne({
      _id: new ObjectId(orderId),
      vendorId,
    });

    if (!order) {
      return { success: false as const, reason: "NOT_FOUND" };
    }

    return { success: false as const, reason: "INVALID_STATUS" };
  }

  const order = await orders.findOne({
    _id: new ObjectId(orderId),
    vendorId,
  });

  return { success: true as const, order };
};

// VENDOR: UPDATE ORDER STATUS
export const updateVendorOrderStatus = async (
  vendorId: string,
  orderId: string,
  nextStatus: string
) => {
  const db = await connectDB();
  const orders = db.collection("orders");

  const order = await orders.findOne({
    _id: new ObjectId(orderId),
    vendorId,
  });

  if (!order) {
    return { success: false as const, reason: "NOT_FOUND" };
  }

  const allowedTransitions: Record<string, string> = {
    CONFIRMED: "PREPARING",
    PREPARING: "OUT_FOR_DELIVERY",
    OUT_FOR_DELIVERY: "DELIVERED",
  };

  if (allowedTransitions[order.status] !== nextStatus) {
    return { success: false as const, reason: "INVALID_TRANSITION" };
  }

  const result = await orders.updateOne(
    {
      _id: new ObjectId(orderId),
      vendorId,
      status: order.status,
    },
    {
      $set: {
        status: nextStatus,
        updatedAt: new Date(),
      },
    }
  );

  if (result.modifiedCount === 0) {
    return { success: false as const, reason: "INVALID_TRANSITION" };
  }

  const updatedOrder = await orders.findOne({
    _id: new ObjectId(orderId),
    vendorId,
  });

  return { success: true as const, order: updatedOrder };
};
