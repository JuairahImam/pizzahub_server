
import { betterAuth } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import connectDB from "./database.js";
import { jwt } from "better-auth/plugins";
export const auth = betterAuth({
  database: mongodbAdapter(await connectDB()),

  user: {
    additionalFields: {
      role: {
        type: ["customer", "vendor", "admin"],
        required: false,
        defaultValue: "customer",
        input: false,
      },

      isBlocked: {
        type: "boolean",
        required: false,
        defaultValue: false,
        input: false,
      },

      // Premium subscription fields
      isPremium: {
        type: "boolean",
        required: false,
        defaultValue: false,
        input: false,
      },

      subscriptionStatus: {
        type: ["FREE", "ACTIVE", "CANCELLED", "PAST_DUE"],
        required: false,
        defaultValue: "FREE",
        input: false,
      },

      stripeCustomerId: {
        type: "string",
        required: false,
        input: false,
      },

      stripeSubscriptionId: {
        type: "string",
        required: false,
        input: false,
      },

      premiumExpiresAt: {
        type: "date",
        required: false,
        input: false,
      },
    },
  },

  emailAndPassword: {
    enabled: true,
  },

  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
    },
  },

  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL,
  trustedOrigins: [
    "http://localhost:3000",
    "https://pizzahubclient.vercel.app",
    ...(process.env.CLIENT_URL ? [process.env.CLIENT_URL] : []),
  ],
  // The deployed frontend and API are on different sites (vercel.app ->
  // onrender.com). SameSite=Lax cookies are not sent on those cross-site
  // fetches, so sessions appear empty and protected routes redirect to login.
  advanced: {
    defaultCookieAttributes: {
      sameSite: "none",
      secure: true,
    },
  },
  plugins: [jwt()],
});
