/**
 * Replace placeholder images on the FIVE EXISTING demo menu items only.
 *
 * Safety rules:
 * - Default mode is a DRY RUN (read-only). No writes unless BOTH
 *   UPDATE_IMAGES_TARGET=production and UPDATE_IMAGES_COMMIT=1 are set.
 * - Only updates `imageUrl` and `updatedAt` on existing demo items matched by
 *   { vendorId, name }. It never inserts, deletes, or modifies any other field
 *   (no orders, transactions, users, restaurants, subscriptions, prices,
 *   approval status, or availability).
 * - Idempotent: an item whose imageUrl is already a real Unsplash URL is
 *   skipped.
 * - Image URLs were verified (HTTP 200 image/jpeg, visually checked food).
 *
 * Dry run:
 *   npx tsx src/scripts/update-demo-images.ts
 *
 * Only after explicit owner approval:
 *   UPDATE_IMAGES_TARGET=production UPDATE_IMAGES_COMMIT=1 \
 *     npx tsx src/scripts/update-demo-images.ts
 */

import type { Db } from "mongodb";
import connectDB from "../config/database.js";

const img = (photoId: string) =>
  `https://images.unsplash.com/photo-${photoId}?auto=format&fit=crop&w=900&q=80`;

const IMAGE_UPDATES = [
  { name: "Coke", imageUrl: img("1554866585-cd94860890b7") }, // Coca-Cola can
  { name: "Garlic Bread", imageUrl: img("1619531040576-f9416740661b") }, // garlic bread slices
  { name: "Pepperoni Pizza", imageUrl: img("1628840042765-356cda07504e") }, // pepperoni pizza
  { name: "Chicken BBQ Pizza", imageUrl: img("1565299624946-b28f40a0ae38") }, // chicken pizza
  { name: "Margherita Pizza", imageUrl: img("1574071318508-1cdbab80d002") }, // classic margherita
];

const run = async () => {
  const target = process.env.UPDATE_IMAGES_TARGET ?? "unspecified";
  const commit =
    process.env.UPDATE_IMAGES_COMMIT === "1" &&
    target === "production";

  if (process.env.UPDATE_IMAGES_COMMIT === "1" && target !== "production") {
    throw new Error(
      "Set UPDATE_IMAGES_TARGET=production to confirm the target environment."
    );
  }

  const db: Db = await connectDB();
  const users = db.collection("user");
  const vendor = await users.findOne({
    name: "PizzaHub Demo Vendor",
    role: "vendor",
  });
  if (!vendor) throw new Error("Demo vendor not found; nothing was changed.");
  const vendorId = vendor._id.toString();

  const menuItems = db.collection("menuItems");
  let updated = 0;
  let skipped = 0;

  console.log(
    JSON.stringify(
      {
        mode: commit ? "COMMIT (writes enabled)" : "DRY RUN (read-only)",
        target,
        vendorId,
        items: IMAGE_UPDATES.length,
      },
      null,
      2
    )
  );

  for (const item of IMAGE_UPDATES) {
    const existing = await menuItems.findOne({ vendorId, name: item.name });
    if (!existing) {
      skipped += 1;
      console.log(`SKIP (not found): ${item.name}`);
      continue;
    }
    if (!existing.imageUrl.includes("placehold.co")) {
      skipped += 1;
      console.log(`SKIP (already has a real image): ${item.name}`);
      continue;
    }
    if (!commit) {
      console.log(`WOULD UPDATE image: ${item.name}`);
      continue;
    }
    await menuItems.updateOne(
      { _id: existing._id },
      { $set: { imageUrl: item.imageUrl, updatedAt: new Date() } }
    );
    updated += 1;
    console.log(`UPDATED image: ${item.name}`);
  }

  console.log(JSON.stringify({ updated, skipped }, null, 2));
};

run()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(
      "Image update failed:",
      error instanceof Error ? error.message : error
    );
    process.exit(1);
  });
