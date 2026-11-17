
import connectDB from "../config/database.js";
import { auth } from "../config/auth.js";

const seedAdmin = async () => {
  try {
    const adminName = process.env.ADMIN_NAME;
    const adminEmail = process.env.ADMIN_EMAIL;
    const adminPassword = process.env.ADMIN_PASSWORD;

    if (!adminName || !adminEmail || !adminPassword) {
      throw new Error("Admin environment variables are missing.");
    }

    const db = await connectDB();
    const users = db.collection("user");

    const existingUser = await users.findOne({
      email: adminEmail,
    });

    if (!existingUser) {
      await auth.api.signUpEmail({
        body: {
          name: adminName,
          email: adminEmail,
          password: adminPassword,
        },
      });
    }

    const result = await users.updateOne(
      { email: adminEmail },
      {
        $set: {
          role: "admin",
          updatedAt: new Date(),
        },
      }
    );

    if (result.matchedCount === 0) {
      throw new Error("Admin account could not be found.");
    }

    console.log("Admin account created/updated successfully!");
    console.log(`Admin email: ${adminEmail}`);

    process.exit(0);
  } catch (error) {
    console.error("Admin seeding failed:", error);
    process.exit(1);
  }
};

seedAdmin();
