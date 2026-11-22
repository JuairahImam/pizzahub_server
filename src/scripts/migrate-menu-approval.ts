import connectDB from "../config/database.js";

const run = async () => {
  const db = await connectDB();
  const menuItems = db.collection("menuItems");

  const filter = {
    approvalStatus: { $exists: false },
  };

  const migrationTimestamp = new Date();

  const result = await menuItems.updateMany(filter, {
    $set: {
      approvalStatus: "APPROVED",
      rejectionReason: null,
      reviewedAt: migrationTimestamp,
      reviewedBy: null,
    },
  });

  await menuItems.createIndex({ vendorId: 1, approvalStatus: 1 });
  await menuItems.createIndex({ approvalStatus: 1, isAvailable: 1, createdAt: -1 });

  console.log(
    JSON.stringify(
      {
        matchedCount: result.matchedCount,
        modifiedCount: result.modifiedCount,
        migrationTimestamp: migrationTimestamp.toISOString(),
      },
      null,
      2
    )
  );
};

run()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Menu approval migration failed:", error);
    process.exit(1);
  });
