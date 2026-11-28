/**
 * Backfill assignment-spec field aliases without renaming existing fields.
 *
 *  - menuItems: itemName <- name, status <- approvalStatus
 *  - orders:    itemId <- first items[].menuItemId, status CONFIRMED -> ACCEPTED
 *  - user:      subscriptionPlan, subscriptionExpiresAt, businessName
 *
 * Dry run by default. To write:
 *   SPEC_MIGRATE_COMMIT=1 npx tsx src/scripts/migrate-spec-fields.ts
 *
 * Idempotent: only documents missing an alias (or still using CONFIRMED) are
 * modified. Nothing is deleted.
 */

import connectDB from "../config/database.js";

const commit = process.env.SPEC_MIGRATE_COMMIT === "1";

const run = async () => {
  const db = await connectDB();
  const menuItems = db.collection("menuItems");
  const orders = db.collection("orders");
  const users = db.collection("user");
  const restaurants = db.collection("restaurants");

  console.log(
    JSON.stringify(
      { mode: commit ? "COMMIT (writes enabled)" : "DRY RUN (read-only)" },
      null,
      2
    )
  );

  // 1. Menu items.
  const menuDocs = await menuItems
    .find(
      { $or: [{ itemName: { $exists: false } }, { status: { $exists: false } }] },
      { projection: { name: 1, approvalStatus: 1 } }
    )
    .toArray();

  let menuUpdated = 0;
  for (const item of menuDocs) {
    if (commit) {
      await menuItems.updateOne(
        { _id: item._id },
        {
          $set: {
            itemName: item.name,
            status: item.approvalStatus,
          },
        }
      );
    }
    menuUpdated += 1;
  }

  // 2. Orders.
  const legacyOrders = await orders
    .find(
      {
        $or: [
          { itemId: { $exists: false } },
          { status: "CONFIRMED" },
        ],
      },
      { projection: { items: 1, status: 1 } }
    )
    .toArray();

  let ordersUpdated = 0;
  for (const order of legacyOrders) {
    if (commit) {
      await orders.updateOne(
        { _id: order._id },
        {
          $set: {
            itemId: Array.isArray(order.items)
              ? order.items[0]?.menuItemId ?? null
              : null,
            status: order.status === "CONFIRMED" ? "ACCEPTED" : order.status,
          },
        }
      );
    }
    ordersUpdated += 1;
  }

  // 3. Users.
  const userDocs = await users
    .find(
      {
        $or: [
          { subscriptionPlan: { $exists: false } },
          { subscriptionExpiresAt: { $exists: false } },
          { businessName: { $exists: false } },
        ],
      },
      {
        projection: {
          role: 1,
          isPremium: 1,
          subscriptionStatus: 1,
          premiumExpiresAt: 1,
        },
      }
    )
    .toArray();

  let usersUpdated = 0;
  for (const user of userDocs) {
    const isPremium =
      user.isPremium === true && user.subscriptionStatus === "ACTIVE";

    let businessName: string | null = null;
    if (user.role === "vendor") {
      const restaurant = await restaurants.findOne(
        { vendorId: user._id.toString() },
        { projection: { name: 1 } }
      );
      businessName = restaurant?.name ?? null;
    }

    if (commit) {
      await users.updateOne(
        { _id: user._id },
        {
          $set: {
            subscriptionPlan: isPremium ? "premium" : "free",
            subscriptionExpiresAt: user.premiumExpiresAt ?? null,
            businessName,
          },
        }
      );
    }
    usersUpdated += 1;
  }

  console.log(
    JSON.stringify(
      {
        menuItemsUpdated: menuUpdated,
        ordersUpdated,
        usersUpdated,
        stillDryRun: !commit,
      },
      null,
      2
    )
  );
};

run()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(
      "Spec field migration failed:",
      error instanceof Error ? error.message : error
    );
    process.exit(1);
  });
