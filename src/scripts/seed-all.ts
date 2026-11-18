
import { ObjectId } from "mongodb";
import connectDB from "../config/database.js";
import { auth } from "../config/auth.js";

interface SeedMenuItem {
  _id: ObjectId;
  name: string;
  price: number;
}

const seedUser = async (
  name: string,
  email: string,
  password: string,
  role: "admin" | "vendor" | "customer"
): Promise<string> => {
  const db = await connectDB();
  const users = db.collection("user");

  let user = await users.findOne({ email });

  if (!user) {
    await auth.api.signUpEmail({
      body: { name, email, password },
    });

    user = await users.findOne({ email });
  }

  if (!user) {
    throw new Error(`Could not create user: ${email}`);
  }

  await users.updateOne(
    { _id: user._id },
    {
      $set: {
        role,
        isBlocked: false,
        updatedAt: new Date(),
      },
    }
  );

  console.log(`${role} account ready: ${email}`);

  return user._id.toString();
};

const seedAll = async () => {
  try {
    const requiredEnv = [
      "ADMIN_NAME",
      "ADMIN_EMAIL",
      "ADMIN_PASSWORD",
      "VENDOR_NAME",
      "VENDOR_EMAIL",
      "VENDOR_PASSWORD",
      "CUSTOMER_NAME",
      "CUSTOMER_EMAIL",
      "CUSTOMER_PASSWORD",
    ];

    for (const key of requiredEnv) {
      if (!process.env[key]) {
        throw new Error(`Missing environment variable: ${key}`);
      }
    }

    const emails = [
      process.env.ADMIN_EMAIL,
      process.env.VENDOR_EMAIL,
      process.env.CUSTOMER_EMAIL,
    ].map((email) => email!.toLowerCase());

    if (new Set(emails).size !== emails.length) {
      throw new Error(
        "Admin, vendor and customer emails must be different."
      );
    }

    // 1. Create users
    const adminId = await seedUser(
      process.env.ADMIN_NAME!,
      process.env.ADMIN_EMAIL!,
      process.env.ADMIN_PASSWORD!,
      "admin"
    );

    const vendorId = await seedUser(
      process.env.VENDOR_NAME!,
      process.env.VENDOR_EMAIL!,
      process.env.VENDOR_PASSWORD!,
      "vendor"
    );

    const customerId = await seedUser(
      process.env.CUSTOMER_NAME!,
      process.env.CUSTOMER_EMAIL!,
      process.env.CUSTOMER_PASSWORD!,
      "customer"
    );

    const db = await connectDB();

    const restaurants = db.collection("restaurants");
    const menuItems = db.collection("menuItems");
    const orders = db.collection("orders");

    // 2. Create restaurant
    let restaurant = await restaurants.findOne({ vendorId });

    if (!restaurant) {
      const now = new Date();

      const result = await restaurants.insertOne({
        vendorId,
        name: "PizzaHub Demo Restaurant",
        description: "Fresh and delicious pizzas for everyone.",
        address: "Dhanmondi, Dhaka, Bangladesh",
        phone: "01700000000",
        createdAt: now,
        updatedAt: now,
      });

      restaurant = await restaurants.findOne({
        _id: result.insertedId,
      });
    }

    if (!restaurant) {
      throw new Error("Restaurant creation failed.");
    }

    const restaurantId = restaurant._id.toString();

    console.log("Restaurant ready.");

    // 3. Create menu items
    const menuData = [
      {
        name: "Margherita Pizza",
        description: "Classic pizza with cheese, tomato and basil.",
        category: "Pizza",
        price: 450,
      },
      {
        name: "Chicken BBQ Pizza",
        description: "BBQ chicken with mozzarella cheese.",
        category: "Pizza",
        price: 650,
      },
      {
        name: "Pepperoni Pizza",
        description: "Pepperoni with mozzarella and tomato sauce.",
        category: "Pizza",
        price: 700,
      },
      {
        name: "Garlic Bread",
        description: "Toasted bread with garlic butter.",
        category: "Sides",
        price: 180,
      },
      {
        name: "Coke",
        description: "Chilled soft drink.",
        category: "Drinks",
        price: 60,
      },
    ];

    const seededMenuItems: SeedMenuItem[] = [];

    for (const item of menuData) {
      const existing = await menuItems.findOne({
        vendorId,
        name: item.name,
      });

      if (existing) {
        seededMenuItems.push({
          _id: existing._id,
          name: existing.name,
          price: existing.price,
        });
        continue;
      }

      const now = new Date();

      const result = await menuItems.insertOne({
        vendorId,
        restaurantId,
        ...item,
        imageUrl: "https://placehold.co/600x400?text=PizzaHub",
        imageId: "",
        isAvailable: true,
        createdAt: now,
        updatedAt: now,
      });

      seededMenuItems.push({
        _id: result.insertedId,
        name: item.name,
        price: item.price,
      });
    }

    console.log(`${seededMenuItems.length} menu items ready.`);

    // 4. Create demo orders
    const orderSeeds = [
      {
        seedKey: "pizzahub-demo-order-001",
        menuNames: ["Margherita Pizza", "Coke"],
        quantities: [2, 2],
        deliveryAddress: "House 10, Road 5, Dhanmondi, Dhaka",
        contactPhone: "01700000001",
      },
      {
        seedKey: "pizzahub-demo-order-002",
        menuNames: ["Chicken BBQ Pizza", "Garlic Bread"],
        quantities: [1, 1],
        deliveryAddress: "House 20, Road 7, Mohammadpur, Dhaka",
        contactPhone: "01700000002",
      },
    ];

    for (const seed of orderSeeds) {
      const existingOrder = await orders.findOne({
        seedKey: seed.seedKey,
      });

      if (existingOrder) {
        continue;
      }

      const selectedItems = seed.menuNames.map((name, index) => {
        const menuItem = seededMenuItems.find(
          (item) => item.name === name
        );

        if (!menuItem) {
          throw new Error(`Menu item not found: ${name}`);
        }

        const quantity = seed.quantities[index];

        return {
          menuItemId: menuItem._id.toString(),
          name: menuItem.name,
          price: menuItem.price,
          quantity,
          subtotal: menuItem.price * quantity,
        };
      });

      const totalAmount = selectedItems.reduce(
        (total, item) => total + item.subtotal,
        0
      );

      const now = new Date();

      await orders.insertOne({
        seedKey: seed.seedKey,
        customerId,
        customerName: process.env.CUSTOMER_NAME,
        customerEmail: process.env.CUSTOMER_EMAIL,
        vendorId,
        restaurantId,
        restaurantName: restaurant.name,
        items: selectedItems,
        totalAmount,
        deliveryAddress: seed.deliveryAddress,
        contactPhone: seed.contactPhone,
        status: "PENDING",
        rejectionReason: null,
        createdAt: now,
        updatedAt: now,
      });
    }

    console.log("Demo orders ready.");
    console.log("Admin ID:", adminId);
    console.log("Vendor ID:", vendorId);
    console.log("Customer ID:", customerId);
    console.log("PizzaHub seeding completed successfully!");
  } catch (error) {
    console.error("Seeding failed:", error);
    process.exitCode = 1;
  }
};

seedAll();
