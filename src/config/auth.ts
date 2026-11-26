
import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import { getCurrentAuthEndpointContext } from "@better-auth/core/context";
import connectDB from "./database.js";
import { jwt } from "better-auth/plugins";

// Public registration may choose vendor or customer, never admin. Validating
// here (before hashing) keeps the rule on the server even if the UI is bypassed.
const passwordRulesPaths = [
  "/sign-up/email",
  "/change-password",
  "/reset-password",
];

const passwordRulesPlugin = {
  id: "pizzahub-password-rules",
  init(ctx: any) {
    const originalHash = ctx.password.hash;
    return {
      context: {
        password: {
          ...ctx.password,
          async hash(password: string) {
            const endpoint = getCurrentAuthEndpointContext();

            if (endpoint?.path && passwordRulesPaths.includes(endpoint.path)) {
              if (password.length < 6) {
                throw new APIError("BAD_REQUEST", {
                  message: "Password must be at least 6 characters.",
                });
              }

              if (!/[a-z]/.test(password) || !/[A-Z]/.test(password)) {
                throw new APIError("BAD_REQUEST", {
                  message:
                    "Password must contain at least one uppercase and one lowercase letter.",
                });
              }
            }

            return originalHash(password);
          },
        },
      },
    };
  },
};

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

      // Public signup chooses between these two only. `role` is derived from
      // this value in the create hook below, so "admin" can never be requested.
      accountType: {
        type: ["customer", "vendor"],
        required: false,
        defaultValue: "customer",
        input: true,
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

      stripeCheckoutSessionId: {
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
    minPasswordLength: 6,
    maxPasswordLength: 128,
  },

  // Only the allow-listed accountType values can become real roles. This runs
  // for email/password and Google signups, so neither path can create an admin.
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          const requested = (user as Record<string, unknown>).accountType;
          const role = requested === "vendor" ? "vendor" : "customer";

          return { data: { ...user, role, accountType: role } };
        },
      },
    },
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
  plugins: [jwt(), passwordRulesPlugin],
});
