/**
 * Idempotent demo menu seed — PREPARATION ONLY.
 *
 * Safety rules enforced by this script:
 * - Default mode is a DRY RUN. It only reads the database and prints what it
 *   would insert. Nothing is written unless DEMO_SEED_COMMIT=1 is set AND the
 *   owner has explicitly approved running it against the intended target.
 * - It never deletes anything, and never updates users, restaurants, orders,
 *   transactions, or existing menu items.
 * - It reuses the explicitly identified demo vendor / demo restaurant by
 *   looking them up; it never creates user accounts and never invents IDs.
 * - Every inserted item is PENDING and must be APPROVED by an admin through
 *   the real Menu Moderation workflow before it can appear publicly.
 * - It does not grant Premium and does not touch subscription state.
 *
 * Image URLs are verified public Unsplash CDN URLs (HTTP 200, image/jpeg,
 * visually checked against the food). They were NOT uploaded to ImgBB. If
 * ImgBB-hosted images are strictly required, upload via the vendor UI first.
 *
 * Usage (dry run, read-only):
 *   npm run seed:demo-menu
 *
 * Usage (after explicit approval of the target environment):
 *   DEMO_SEED_TARGET=production DEMO_SEED_COMMIT=1 npm run seed:demo-menu
 *   # optional: DEMO_VENDOR_EMAIL=<demo vendor email> to target by email
 * DEMO_SEED_TARGET must be one of production|staging|local when committing.
 */

import type { Db } from "mongodb";
import connectDB from "../config/database.js";

type DemoItem = {
  name: string;
  description: string;
  category: string;
  price: number;
  imageUrl: string;
};

const img = (photoId: string) =>
  `https://images.unsplash.com/photo-${photoId}?auto=format&fit=crop&w=900&q=80`;

const DEMO_ITEMS: DemoItem[] = [
  {
    name: "Margherita Classic",
    description: "San Marzano tomato, fresh mozzarella and basil on a slow-fermented crust.",
    category: "Classic Pizzas",
    price: 499,
    imageUrl: img("1574071318508-1cdbab80d002"),
  },
  {
    name: "Pepperoni Feast",
    description: "Generous pepperoni, mozzarella and a rich tomato base.",
    category: "Classic Pizzas",
    price: 699,
    imageUrl: img("1628840042765-356cda07504e"),
  },
  {
    name: "BBQ Chicken Supreme",
    description: "Smoky BBQ chicken, red onion and melted mozzarella.",
    category: "Specialty / Gourmet Pizzas",
    price: 749,
    imageUrl: img("1594007654729-407eedc4be65"),
  },
  {
    name: "Four Cheese Delight",
    description: "Mozzarella, cheddar, parmesan and ricotta on a golden crust.",
    category: "Vegetarian Pizzas",
    price: 799,
    imageUrl: img("1520201163981-8cc95007dd2a"),
  },
  {
    name: "Spicy Beef Volcano",
    description: "Seasoned beef, peppers, chili flakes and molten cheese.",
    category: "Meat Lovers",
    price: 849,
    imageUrl: img("1604382354936-07c5d9983bd3"),
  },
  {
    name: "Garden Fresh Veggie Pizza",
    description: "Spinach, mushrooms, peppers and fresh herbs.",
    category: "Vegetarian Pizzas",
    price: 599,
    imageUrl: img("1593560708920-61dd98c46a4e"),
  },
  {
    name: "Hawaiian Chicken Pizza",
    description: "Chicken, pineapple and mozzarella with a sweet-savory glaze.",
    category: "Specialty / Gourmet Pizzas",
    price: 729,
    imageUrl: img("1565299624946-b28f40a0ae38"),
  },
  {
    name: "Mushroom Alfredo Pizza",
    description: "Creamy Alfredo sauce, mushrooms and mozzarella.",
    category: "Vegetarian Pizzas",
    price: 699,
    imageUrl: img("1513104890138-7c749659a591"),
  },
  {
    name: "Garlic Bread",
    description: "Toasted bread with garlic butter and herbs.",
    category: "Sides & Appetizers",
    price: 199,
    imageUrl: img("1619531040576-f9416740661b"),
  },
  {
    name: "Loaded Cheesy Fries",
    description: "Golden fries under a blanket of melted cheese.",
    category: "Sides & Appetizers",
    price: 249,
    imageUrl: img("1573080496219-bb080dd4f877"),
  },
  {
    name: "Chocolate Brownie",
    description: "Rich chocolate brownie with a soft center.",
    category: "Beverages & Desserts",
    price: 179,
    imageUrl: img("1606313564200-e75d5e30476c"),
  },
  {
    name: "Fresh Lemonade",
    description: "Fresh lemon and mint served over ice.",
    category: "Beverages & Desserts",
    price: 129,
    imageUrl: img("1513558161293-cdaf765ed2fd"),
  },
];

const resolveDemoVendor = async (db: Db) => {
  const users = db.collection("user");
  const demoEmail = process.env.DEMO_VENDOR_EMAIL;

  if (demoEmail) {
    const byEmail = await users.findOne({ email: demoEmail, role: "vendor" });
    if (!byEmail) throw new Error("DEMO_VENDOR_EMAIL did not match a vendor account.");
    return byEmail;
  }

  // Explicitly identified demo account (no customer accounts are created).
  const matches = await users
    .find({ name: "PizzaHub Demo Vendor", role: "vendor" })
    .limit(2)
    .toArray();

  if (matches.length !== 1) {
    throw new Error("Expected exactly one demo vendor account; found a different count.");
  }

  return matches[0];
};

const run = async () => {
  const commit = process.env.DEMO_SEED_COMMIT === "1";
  const target = process.env.DEMO_SEED_TARGET ?? "unspecified";

  if (
    commit &&
    target !== "production" &&
    target !== "staging" &&
    target !== "local"
  ) {
    throw new Error(
      "Set DEMO_SEED_TARGET=production|staging|local to confirm the target environment before committing."
    );
  }

  const db = await connectDB();

  const vendor = await resolveDemoVendor(db);
  const vendorId = vendor._id.toString();

  const restaurant = await db
    .collection("restaurants")
    .findOne({ vendorId });
  if (!restaurant) {
    throw new Error("Demo vendor has no restaurant record; no data was written.");
  }
  const restaurantId = restaurant._id.toString();

  const menuItems = db.collection("menuItems");
  const now = new Date();

  console.log(
    JSON.stringify(
      {
        mode: commit ? "COMMIT (writes enabled)" : "DRY RUN (read-only)",
        targetEnvironment: target,
        targetVendorId: vendorId,
        targetRestaurantId: restaurantId,
        targetRestaurantName: restaurant.name,
        proposedItems: DEMO_ITEMS.length,
      },
      null,
      2
    )
  );

  let inserted = 0;
  let skipped = 0;

  for (const item of DEMO_ITEMS) {
    const existing = await menuItems.findOne({ vendorId, name: item.name });
    if (existing) {
      skipped += 1;
      console.log(`SKIP (already exists): ${item.name}`);
      continue;
    }

    if (!commit) {
      console.log(`WOULD INSERT (PENDING): ${item.name} | ${item.category} | ৳${item.price}`);
      continue;
    }

    await menuItems.insertOne({
      vendorId,
      restaurantId,
      name: item.name,
      description: item.description,
      category: item.category,
      price: item.price,
      imageUrl: item.imageUrl,
      imageId: "",
      isAvailable: true,
      approvalStatus: "PENDING",
      rejectionReason: null,
      reviewedAt: null,
      reviewedBy: null,
      createdAt: now,
      updatedAt: now,
    });
    inserted += 1;
    console.log(`INSERTED (PENDING): ${item.name}`);
  }

  console.log(
    JSON.stringify({ inserted, skipped, approvalRequired: inserted > 0 }, null, 2)
  );
  console.log(
    "All inserted items are PENDING. Approve only these demo items via Admin > Menu Moderation."
  );
};

run()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Demo menu seed failed:", error instanceof Error ? error.message : error);
    process.exit(1);
  });
