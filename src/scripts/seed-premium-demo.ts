/**
 * Premium demo dataset — works against LOCAL or PRODUCTION (DB comes from
 * MONGODB_URI in the .env / hosting environment you run this with).
 *
 * Exact accounts supplied by the owner:
 *  - admin:    nafisa / nafisa@gpizzahub.com / Nafisa@@22##
 *  - vendor:   emtiaz ahmed / emtiaz2060@gmail.com  -> restaurant "oven story pizza" (Dhanmondi, PREMIUM)
 *  - vendor:   alif / alif@gmail.com                -> restaurant "the pizza lab" (Banani)
 *  - customer: sakib ahmed / sakib@gmail.com
 * Four extra demo customers are included so orders/vendor-request lists look full.
 *
 * Image URLs are the owner's direct image links (decoded from Google image
 * search result pages). They are verified HTTP 200. Run this script from the
 * same environment whose NEXT_PUBLIC_API_URL / deploy config is in use, and
 * deploy the updated next.config.ts so <Image> allows these hostnames.
 *
 * Creates (idempotently, no deletions):
 *  - 8 users, 2 restaurants, 11 approved menu items (8 + 3),
 *    8 orders, 8 vendor requests, 8 transactions
 *
 * Users are created through Better Auth (hashed passwords) and, on commit,
 * their credential passwords are set to the values below so these logins work
 * even if the email already existed in the target database.
 *
 * DRY RUN by default. To write:
 *   DEMO_SEED_TARGET=local DEMO_SEED_COMMIT=1 npm run seed:premium-demo
 *   DEMO_SEED_TARGET=production DEMO_SEED_COMMIT=1 npm run seed:premium-demo
 * DEMO_SEED_TARGET must be local|staging|production.
 *
 * To keep passwords of already-existing accounts, add DEMO_SEED_FORCE_PASSWORD=0.
 */

import { runWithEndpointContext } from "@better-auth/core/context";
import { ObjectId } from "mongodb";

import connectDB from "../config/database.js";
import { auth } from "../config/auth.js";

const commit = process.env.DEMO_SEED_COMMIT === "1";
const target = process.env.DEMO_SEED_TARGET ?? "unspecified";
const forcePasswords = process.env.DEMO_SEED_FORCE_PASSWORD !== "0";

if (commit && !["local", "staging", "production"].includes(target)) {
  throw new Error(
    "Set DEMO_SEED_TARGET=local|staging|production before committing."
  );
}

const img = (photoId: string) =>
  `https://images.unsplash.com/photo-${photoId}?auto=format&fit=crop&w=900&q=80`;

const daysFromNow = (days: number) =>
  new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);

const yearFromNow = () => new Date(Date.now() + 365 * 86_400_000);

const DHANMONDI = "Dhanmondi, Dhaka, Bangladesh";
const BANANI = "Banani, Dhaka, Bangladesh";
const UTTARA = "Uttara, Dhaka, Bangladesh";

type UserSeed = {
  key: string;
  name: string;
  email: string;
  password: string;
  role: "admin" | "vendor" | "customer";
  premium?: boolean;
};

const USERS: UserSeed[] = [
  { key: "admin", name: "nafisa", email: "nafisa@gpizzahub.com", password: "Nafisa@@22##", role: "admin" },
  { key: "vendor1", name: "emtiaz ahmed", email: "emtiaz2060@gmail.com", password: "OvenStory@@22", role: "vendor", premium: true },
  { key: "vendor2", name: "alif", email: "alif@gmail.com", password: "PizzaLab@@22", role: "vendor" },
  { key: "customer1", name: "sakib ahmed", email: "sakib@gmail.com", password: "Sakib@@22", role: "customer" },
  { key: "customer2", name: "karim sheikh", email: "karim.demo@pizzahub.com", password: "DemoPass123", role: "customer" },
  { key: "customer3", name: "jubair hossain", email: "jubair.demo@pizzahub.com", password: "DemoPass123", role: "customer" },
  { key: "customer4", name: "mim chowdhury", email: "mim.demo@pizzahub.com", password: "DemoPass123", role: "customer" },
  { key: "customer5", name: "rahat islam", email: "rahat.demo@pizzahub.com", password: "DemoPass123", role: "customer" },
];

const RESTAURANTS = [
  {
    key: "vendor1",
    name: "oven story pizza",
    description: "Wood-fired pizzas, slow-fermented dough and premium ingredients in the heart of Dhanmondi.",
    address: DHANMONDI,
    phone: "01710000001",
  },
  {
    key: "vendor2",
    name: "the pizza lab",
    description: "A neighbourhood pizza kitchen crafting fresh favourites daily in Banani.",
    address: BANANI,
    phone: "01710000009",
  },
];

type MenuSeed = {
  vendorKey: string;
  name: string;
  description: string;
  category: string;
  price: number;
  imageUrl: string;
};

const MENU_ITEMS: MenuSeed[] = [
  {
    vendorKey: "vendor1",
    name: "Margherita Classic",
    description: "San Marzano tomato, fresh mozzarella and basil on a slow-fermented crust.",
    category: "Classic Pizzas",
    price: 499,
    imageUrl: "https://allforpizza.com/wp-content/uploads/2022/07/1460A7EC-CF3B-40E8-B05F-A21E12E85EC6.jpeg",
  },
  {
    vendorKey: "vendor1",
    name: "Pepperoni Feast",
    description: "Generous pepperoni, mozzarella and a rich tomato base.",
    category: "Classic Pizzas",
    price: 699,
    imageUrl: "https://thumbs.dreamstime.com/b/pepperoni-pizza-isolated-white-background-pepperoni-pizza-isolated-white-background-traditional-italian-fast-food-283008106.jpg",
  },
  {
    vendorKey: "vendor1",
    name: "BBQ Chicken Supreme",
    description: "Smoky BBQ chicken, red onion and melted mozzarella.",
    category: "Specialty / Gourmet Pizzas",
    price: 749,
    imageUrl: "https://pinoycupidgifts.com/wp-content/uploads/2022/08/BBQ-CHICKEN-SUPREME-by-Pizza-Hut.jpg",
  },
  {
    vendorKey: "vendor1",
    name: "Four Cheese Delight",
    description: "Mozzarella, cheddar, parmesan and ricotta on a golden crust.",
    category: "Vegetarian Pizzas",
    price: 799,
    // Upgraded the supplied http:// link to https:// (verified 200) for mixed-content safety.
    imageUrl: "https://pizzapro.in/cdn/shop/articles/four-cheese-pizza-pizza-pro_379991d3-9d40-4a9c-9ef7-33b247b7357e.jpg?v=1778491181",
  },
  {
    vendorKey: "vendor1",
    name: "Spicy Beef Volcano",
    description: "Seasoned beef, peppers, chili flakes and molten cheese.",
    category: "Meat Lovers",
    price: 849,
    imageUrl: "https://m.media-amazon.com/images/I/91gA3vIu9BL._AC_UF350,350_QL80_.jpg",
  },
  {
    vendorKey: "vendor1",
    name: "Garden Fresh Veggie Pizza",
    description: "Spinach, mushrooms, peppers and fresh herbs.",
    category: "Vegetarian Pizzas",
    price: 599,
    imageUrl: "https://cdn.dotpe.in/longtail/store-items/8604630/Sc51qinq.webp",
  },
  {
    vendorKey: "vendor1",
    name: "Garlic Bread",
    description: "Toasted bread with garlic butter and herbs.",
    category: "Sides & Appetizers",
    price: 199,
    imageUrl: "https://img.magnific.com/free-psd/delicious-garlic-bread-slices-woven-basket_84443-72778.jpg?semt=ais_hybrid&w=740&q=80",
  },
  {
    vendorKey: "vendor1",
    name: "Fresh Lemonade",
    description: "Fresh lemon and mint served over ice.",
    category: "Beverages & Desserts",
    price: 129,
    imageUrl: "https://images.unsplash.com/photo-1623084918757-56d74eb2c650?fm=jpg&q=60&w=3000&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=NHwxMjA3fDA%3D",
  },
  { vendorKey: "vendor2", name: "Hawaiian Chicken Pizza", description: "Chicken, pineapple and mozzarella with a sweet-savory glaze.", category: "Specialty / Gourmet Pizzas", price: 729, imageUrl: img("1565299624946-b28f40a0ae38") },
  { vendorKey: "vendor2", name: "Mushroom Alfredo Pizza", description: "Creamy Alfredo sauce, mushrooms and mozzarella.", category: "Vegetarian Pizzas", price: 699, imageUrl: img("1513104890138-7c749659a591") },
  { vendorKey: "vendor2", name: "Chocolate Brownie", description: "Rich chocolate brownie with a soft center.", category: "Beverages & Desserts", price: 179, imageUrl: img("1606313564200-e75d5e30476c") },
];

type OrderSeed = {
  seedKey: string;
  customerKey: string;
  vendorKey: string;
  items: Array<{ name: string; quantity: number }>;
  deliveryAddress: string;
  contactPhone: string;
  deliveryOffset: number;
  customerMessage?: string;
  status: string;
  rejectionReason?: string | null;
};

const ORDERS: OrderSeed[] = [
  { seedKey: "oven-story-order-001", customerKey: "customer1", vendorKey: "vendor1", items: [{ name: "Margherita Classic", quantity: 2 }, { name: "Garlic Bread", quantity: 1 }], deliveryAddress: `House 10, Road 5, ${DHANMONDI}`, contactPhone: "01710000011", deliveryOffset: 1, customerMessage: "Please ring the bell twice.", status: "PENDING" },
  { seedKey: "oven-story-order-002", customerKey: "customer2", vendorKey: "vendor1", items: [{ name: "Pepperoni Feast", quantity: 1 }, { name: "Fresh Lemonade", quantity: 2 }], deliveryAddress: `House 22, Road 7, ${DHANMONDI}`, contactPhone: "01710000012", deliveryOffset: 1, status: "ACCEPTED" },
  { seedKey: "oven-story-order-003", customerKey: "customer3", vendorKey: "vendor1", items: [{ name: "BBQ Chicken Supreme", quantity: 1 }, { name: "Garlic Bread", quantity: 2 }], deliveryAddress: `Flat 4B, Road 9, ${BANANI}`, contactPhone: "01710000013", deliveryOffset: 2, status: "PREPARING" },
  { seedKey: "oven-story-order-004", customerKey: "customer4", vendorKey: "vendor1", items: [{ name: "Four Cheese Delight", quantity: 1 }], deliveryAddress: `House 8, Road 4, ${UTTARA}`, contactPhone: "01710000014", deliveryOffset: 2, status: "OUT_FOR_DELIVERY" },
  { seedKey: "oven-story-order-005", customerKey: "customer5", vendorKey: "vendor1", items: [{ name: "Spicy Beef Volcano", quantity: 2 }, { name: "Fresh Lemonade", quantity: 1 }], deliveryAddress: `House 31, Road 2, ${DHANMONDI}`, contactPhone: "01710000015", deliveryOffset: 3, status: "DELIVERED" },
  { seedKey: "oven-story-order-006", customerKey: "customer1", vendorKey: "vendor2", items: [{ name: "Hawaiian Chicken Pizza", quantity: 1 }, { name: "Chocolate Brownie", quantity: 1 }], deliveryAddress: `House 14, Road 6, ${BANANI}`, contactPhone: "01710000016", deliveryOffset: -1, status: "DELIVERED" },
  { seedKey: "oven-story-order-007", customerKey: "customer2", vendorKey: "vendor2", items: [{ name: "Mushroom Alfredo Pizza", quantity: 1 }], deliveryAddress: `House 5, Road 3, ${UTTARA}`, contactPhone: "01710000017", deliveryOffset: -2, status: "REJECTED", rejectionReason: "Kitchen was closed for the evening. Please try again tomorrow." },
  { seedKey: "oven-story-order-008", customerKey: "customer3", vendorKey: "vendor1", items: [{ name: "Garden Fresh Veggie Pizza", quantity: 1 }], deliveryAddress: `House 17, Road 11, ${DHANMONDI}`, contactPhone: "01710000018", deliveryOffset: -3, status: "CANCELLED", rejectionReason: "Cancelled by the customer before preparation." },
];

type RequestSeed = {
  userKey: string;
  restaurantName: string;
  message: string;
  status: "APPROVED" | "PENDING" | "REJECTED";
  rejectionReason?: string | null;
  daysAgo: number;
};

const VENDOR_REQUESTS: RequestSeed[] = [
  { userKey: "vendor1", restaurantName: "oven story pizza", message: "Opening our flagship wood-fired kitchen in Dhanmondi.", status: "APPROVED", daysAgo: 120 },
  { userKey: "vendor2", restaurantName: "the pizza lab", message: "Neighbourhood pizza kitchen serving Banani and Uttara.", status: "APPROVED", daysAgo: 90 },
  { userKey: "customer1", restaurantName: "Sakib's Pizza Corner", message: "I have a small kitchen and want to start selling pizzas.", status: "PENDING", daysAgo: 2 },
  { userKey: "customer2", restaurantName: "Karim's Home Bakes", message: "Home-based pizza and sides business.", status: "PENDING", daysAgo: 1 },
  { userKey: "customer3", restaurantName: "Firewood Pizza", message: "Planning a wood-fired takeaway counter.", status: "PENDING", daysAgo: 3 },
  { userKey: "customer4", restaurantName: "Mim's Kitchen", message: "Would like to join as a vendor.", status: "REJECTED", rejectionReason: "Restaurant address is incomplete. Please resubmit with a full address.", daysAgo: 10 },
  { userKey: "customer5", restaurantName: "Pizza Express", message: "Quick-service pizza delivery counter.", status: "REJECTED", rejectionReason: "Business name is too similar to an existing vendor. Please choose another name.", daysAgo: 6 },
  { userKey: "customer3", restaurantName: "First Application", message: "Initial application for a small pizza stall.", status: "REJECTED", rejectionReason: "No valid contact phone was provided in the first application.", daysAgo: 30 },
];

type TransactionSeed = {
  invoiceId: string;
  paymentIntentId: string;
  amount: number;
  currency: string;
  status: "PAID" | "FAILED";
  transactionType: string;
  billingReason: string;
  daysAgo: number;
};

const TRANSACTIONS: TransactionSeed[] = [
  { invoiceId: "in_demo_0001", paymentIntentId: "pi_demo_0001", amount: 1500, currency: "usd", status: "PAID", transactionType: "SUBSCRIPTION_INITIAL", billingReason: "subscription_create", daysAgo: 120 },
  { invoiceId: "in_demo_0002", paymentIntentId: "pi_demo_0002", amount: 1500, currency: "usd", status: "PAID", transactionType: "SUBSCRIPTION_RENEWAL", billingReason: "subscription_cycle", daysAgo: 90 },
  { invoiceId: "in_demo_0003", paymentIntentId: "pi_demo_0003", amount: 1500, currency: "usd", status: "PAID", transactionType: "SUBSCRIPTION_RENEWAL", billingReason: "subscription_cycle", daysAgo: 60 },
  { invoiceId: "in_demo_0004", paymentIntentId: "pi_demo_0004", amount: 1500, currency: "usd", status: "PAID", transactionType: "SUBSCRIPTION_RENEWAL", billingReason: "subscription_cycle", daysAgo: 30 },
  { invoiceId: "in_demo_0005", paymentIntentId: "pi_demo_0005", amount: 1500, currency: "usd", status: "PAID", transactionType: "SUBSCRIPTION_UPDATE", billingReason: "subscription_update", daysAgo: 15 },
  { invoiceId: "in_demo_0006", paymentIntentId: "pi_demo_0006", amount: 1500, currency: "usd", status: "PAID", transactionType: "SUBSCRIPTION_RENEWAL", billingReason: "subscription_cycle", daysAgo: 5 },
  { invoiceId: "in_demo_0007", paymentIntentId: "pi_demo_0007", amount: 1500, currency: "usd", status: "FAILED", transactionType: "SUBSCRIPTION_RENEWAL", billingReason: "subscription_cycle", daysAgo: 3 },
  { invoiceId: "in_demo_0008", paymentIntentId: "pi_demo_0008", amount: 1500, currency: "usd", status: "PAID", transactionType: "SUBSCRIPTION_RENEWAL", billingReason: "subscription_cycle", daysAgo: 1 },
];

const run = async () => {
  const db = await connectDB();
  const users = db.collection("user");
  const restaurants = db.collection("restaurants");
  const menuItems = db.collection("menuItems");
  const orders = db.collection("orders");
  const requests = db.collection("vendorRequests");
  const transactions = db.collection("transactions");

  const maskedUri = (process.env.MONGODB_URI ?? "not set").replace(
    /\/\/[^@]+@/,
    "//***@",
  );

  console.log(JSON.stringify({
    mode: commit ? "COMMIT (writes enabled)" : "DRY RUN (read-only)",
    target,
    database: maskedUri,
    forcePasswords,
    users: USERS.length,
    restaurants: RESTAURANTS.length,
    menuItems: MENU_ITEMS.length,
    orders: ORDERS.length,
    vendorRequests: VENDOR_REQUESTS.length,
    transactions: TRANSACTIONS.length,
  }, null, 2));

  // Better Auth context lets us set a known password even when the email
  // already existed (Google signup or a previous account with another password).
  const authContext: any = commit && forcePasswords ? await auth.$context : null;

  // 1. Users — created through Better Auth so passwords are hashed correctly.
  const userIdByKey = new Map<string, string>();
  for (const seed of USERS) {
    let user = await users.findOne({ email: seed.email });
    if (!user && commit) {
      await auth.api.signUpEmail({
        body: { name: seed.name, email: seed.email, password: seed.password },
      });
      user = await users.findOne({ email: seed.email });
    }
    if (!user) {
      console.log(`WOULD CREATE USER: ${seed.email} (${seed.role})`);
      continue;
    }

    const id = user._id.toString();
    userIdByKey.set(seed.key, id);

    if (commit) {
      const premiumFields = seed.premium
        ? {
            isPremium: true,
            subscriptionStatus: "ACTIVE",
            stripeCustomerId: "cus_demo_oven_story_001",
            stripeSubscriptionId: "sub_demo_oven_story_001",
            premiumExpiresAt: yearFromNow(),
            subscriptionPlan: "premium",
            subscriptionExpiresAt: yearFromNow(),
          }
        : {
            isPremium: false,
            subscriptionStatus: "FREE",
            subscriptionPlan: "free",
          };

      await users.updateOne(
        { _id: user._id },
        {
          $set: {
            role: seed.role,
            accountType: seed.role === "admin" ? "customer" : seed.role,
            isBlocked: false,
            name: seed.name,
            updatedAt: new Date(),
            ...premiumFields,
          },
        }
      );

      if (authContext) {
        const account = await authContext.internalAdapter.findCredentialAccount(id);
        // The custom password-rules plugin reads the current endpoint context,
        // so hashing must run inside one (see @better-auth/core/context).
        const passwordHash = await runWithEndpointContext(
          { context: authContext, path: "/sign-up/email" } as any,
          () => authContext.password.hash(seed.password)
        );
        if (account) {
          await authContext.internalAdapter.updateAccount(account.id, { password: passwordHash });
        } else {
          await authContext.internalAdapter.linkAccount({
            userId: id,
            providerId: "credential",
            accountId: id,
            password: passwordHash,
          });
        }
      }
    }
    console.log(`${commit ? "READY" : "WOULD SET"} USER: ${seed.email} -> ${seed.role}${seed.premium ? " (PREMIUM)" : ""}`);
  }

  if (!commit) {
    console.log("Dry run complete. Re-run with DEMO_SEED_COMMIT=1 to write.");
    return;
  }

  const adminId = userIdByKey.get("admin")!;

  // 2. Restaurants.
  const restaurantByKey = new Map<string, { id: string; name: string }>();
  for (const seed of RESTAURANTS) {
    const vendorId = userIdByKey.get(seed.key)!;
    let restaurant = await restaurants.findOne({ vendorId });
    if (!restaurant) {
      const now = new Date();
      const result = await restaurants.insertOne({
        vendorId,
        name: seed.name,
        description: seed.description,
        address: seed.address,
        phone: seed.phone,
        createdAt: now,
        updatedAt: now,
      });
      restaurant = await restaurants.findOne({ _id: result.insertedId });
    } else {
      // Correct existing live data (e.g. "PizzaHub Demo Restaurant" created by
      // the old seed:all script) instead of leaving the old name in place.
      await restaurants.updateOne(
        { _id: restaurant._id },
        {
          $set: {
            name: seed.name,
            description: seed.description,
            address: seed.address,
            phone: seed.phone,
            updatedAt: new Date(),
          },
        }
      );
      restaurant = await restaurants.findOne({ _id: restaurant._id });
    }
    await users.updateOne(
      { _id: new ObjectId(vendorId) },
      { $set: { businessName: seed.name, updatedAt: new Date() } }
    );
    restaurantByKey.set(seed.key, {
      id: restaurant!._id.toString(),
      name: restaurant!.name as string,
    });
    console.log(`RESTAURANT READY: ${seed.name} (${seed.address})`);
  }

  // 3. Menu items — published (APPROVED + available) so the storefront is full.
  const menuIdByNameByVendor = new Map<string, Map<string, string>>();
  for (const seed of MENU_ITEMS) {
    const vendorId = userIdByKey.get(seed.vendorKey)!;
    const restaurant = restaurantByKey.get(seed.vendorKey)!;
    let item = await menuItems.findOne({ vendorId, name: seed.name });
    if (!item) {
      const now = new Date();
      const result = await menuItems.insertOne({
        vendorId,
        restaurantId: restaurant.id,
        name: seed.name,
        itemName: seed.name,
        status: "APPROVED",
        description: seed.description,
        category: seed.category,
        location: seed.vendorKey === "vendor1" ? DHANMONDI : BANANI,
        price: seed.price,
        imageUrl: seed.imageUrl,
        imageId: "",
        isAvailable: true,
        approvalStatus: "APPROVED",
        rejectionReason: null,
        reviewedAt: now,
        reviewedBy: adminId,
        createdAt: now,
        updatedAt: now,
      });
      item = await menuItems.findOne({ _id: result.insertedId });
    } else {
      // Refresh the owner's images if an earlier run used placeholder URLs.
      await menuItems.updateOne(
        { _id: item._id },
        {
          $set: {
            imageUrl: seed.imageUrl,
            location: item.location || (seed.vendorKey === "vendor1" ? DHANMONDI : BANANI),
            updatedAt: new Date(),
          },
        }
      );
    }
    if (!menuIdByNameByVendor.has(seed.vendorKey)) {
      menuIdByNameByVendor.set(seed.vendorKey, new Map());
    }
    menuIdByNameByVendor.get(seed.vendorKey)!.set(seed.name, item!._id.toString());
    console.log(`MENU READY: ${seed.name} (${seed.vendorKey})`);
  }

  // 4. Orders — one per fulfillment status, across Dhanmondi / Banani / Uttara.
  for (const seed of ORDERS) {
    if (await orders.findOne({ seedKey: seed.seedKey })) {
      console.log(`ORDER SKIP (exists): ${seed.seedKey}`);
      continue;
    }
    const customerId = userIdByKey.get(seed.customerKey)!;
    const vendorId = userIdByKey.get(seed.vendorKey)!;
    const restaurant = restaurantByKey.get(seed.vendorKey)!;
    const customer = USERS.find((u) => u.key === seed.customerKey)!;

    const items = seed.items.map((entry) => {
      const menuId = menuIdByNameByVendor.get(seed.vendorKey)!.get(entry.name);
      const menu = MENU_ITEMS.find((m) => m.name === entry.name)!;
      if (!menuId) throw new Error(`Menu item not found: ${entry.name}`);
      return {
        menuItemId: menuId,
        name: entry.name,
        price: menu.price,
        quantity: entry.quantity,
        subtotal: menu.price * entry.quantity,
      };
    });
    const totalAmount = items.reduce((sum, item) => sum + item.subtotal, 0);
    const now = new Date(Date.now() - 86_400_000);

    await orders.insertOne({
      seedKey: seed.seedKey,
      customerId,
      customerName: customer.name,
      customerEmail: customer.email,
      vendorId,
      restaurantId: restaurant.id,
      restaurantName: restaurant.name,
      itemId: items[0]?.menuItemId ?? null,
      items,
      totalAmount,
      deliveryAddress: seed.deliveryAddress,
      contactPhone: seed.contactPhone,
      deliveryDate: daysFromNow(seed.deliveryOffset),
      customerMessage: seed.customerMessage ?? null,
      status: seed.status,
      rejectionReason: seed.rejectionReason ?? null,
      createdAt: now,
      updatedAt: now,
    });
    console.log(`ORDER INSERTED: ${seed.seedKey} (${seed.status})`);
  }

  // 5. Vendor requests.
  for (const seed of VENDOR_REQUESTS) {
    const userId = userIdByKey.get(seed.userKey)!;
    if (await requests.findOne({ userId, restaurantName: seed.restaurantName })) {
      continue;
    }
    const user = USERS.find((u) => u.key === seed.userKey)!;
    const reviewedAt = new Date(Date.now() - seed.daysAgo * 86_400_000);
    await requests.insertOne({
      userId,
      name: user.name,
      email: user.email,
      restaurantName: seed.restaurantName,
      message: seed.message,
      status: seed.status,
      rejectionReason: seed.rejectionReason ?? null,
      reviewedAt: seed.status === "PENDING" ? null : reviewedAt,
      reviewedBy: seed.status === "PENDING" ? null : adminId,
      createdAt: new Date(Date.now() - (seed.daysAgo + 2) * 86_400_000),
      updatedAt: reviewedAt,
    });
    console.log(`VENDOR REQUEST INSERTED: ${seed.restaurantName} (${seed.status})`);
  }

  // 6. Transactions for the admin Transactions screen.
  const premiumVendorId = userIdByKey.get("vendor1")!;
  const premiumVendor = USERS.find((u) => u.key === "vendor1")!;
  for (const seed of TRANSACTIONS) {
    if (await transactions.findOne({ stripeInvoiceId: seed.invoiceId })) {
      continue;
    }
    const paidAt = new Date(Date.now() - seed.daysAgo * 86_400_000);
    await transactions.insertOne({
      vendorId: premiumVendorId,
      userId: premiumVendorId,
      customerEmail: premiumVendor.email,
      stripeCustomerId: "cus_demo_oven_story_001",
      stripeSubscriptionId: "sub_demo_oven_story_001",
      stripeSessionId: "cs_demo_oven_story_001",
      stripeInvoiceId: seed.invoiceId,
      stripePaymentIntentId: seed.paymentIntentId,
      amount: seed.amount,
      currency: seed.currency,
      status: seed.status,
      transactionType: seed.transactionType,
      plan: "Premium",
      billingReason: seed.billingReason,
      paidAt: seed.status === "PAID" ? paidAt : null,
      transactionDate: paidAt,
      createdAt: paidAt,
      updatedAt: new Date(),
      stripeEventId: `evt_demo_${seed.invoiceId}`,
    });
    console.log(`TRANSACTION INSERTED: ${seed.invoiceId} (${seed.status})`);
  }

  console.log("Premium demo seeding complete.");
  console.log("Sign in with the exact emails/passwords listed at the top of this file.");
};

run()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Premium demo seed failed:", error instanceof Error ? error.message : error);
    process.exit(1);
  });
