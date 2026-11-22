# PizzaHub API — Backend README

PizzaHub backend is an Express 5, TypeScript, MongoDB official driver server using Better Auth + JWT for auth, role-based access control, Stripe for Premium subscriptions/payments, and ImgBB for image hosting.

Repository: `https://github.com/JuairahImam/pizzahub_server.git`

Live API (verified): `https://pizzahub-server-toql.onrender.com`

## Overview

PizzaHub API powers:

- Public real-time menu browsing for customers.
- Customer order creation, history, details, and pending cancellation.
- Vendor restaurant, menu item CRUD, order fulfillment, and Premium subscription flows.
- Admin user management, menu moderation, and payment transaction records.
- ImgBB uploads for vendor menu images and user profile images.
- Stripe Checkout and signed webhook handling.
- Health and root endpoints for deployment checks.

## Technology stack

| Layer | Technology |
| --- | --- |
| Language | TypeScript |
| Server | Express 5 |
| Database | MongoDB official driver |
| Auth | Better Auth with email/password and JWT plugin |
| Token verification | `jose`, Better Auth JWKS |
| Payments | Stripe Checkout and webhooks |
| Image hosting | ImgBB |
| Uploads | Multer memory storage |
| Local runner | `tsx` |

## Project structure

```text
src/
├── config/
│   ├── auth.ts
│   ├── database.ts
│   └── stripe.ts
├── controllers/
│   ├── admin-dashboard.controller.ts
│   ├── admin-transaction.controller.ts
│   ├── admin-users.controller.ts
│   ├── admin.controller.ts
│   ├── customer-menu.controller.ts
│   ├── image.controller.ts
│   ├── menu.controller.ts
│   ├── order.controller.ts
│   ├── profile.controller.ts
│   ├── stripe-webhook.controller.ts
│   ├── stripe.controller.ts
│   ├── vendor-order.controller.ts
│   └── vendor.controller.ts
├── middlewares/
│   ├── auth.middleware.ts
│   ├── jwt.middleware.ts
│   ├── role.middleware.ts
│   └── upload.middleware.ts
├── routes/
│   ├── admin.routes.ts
│   ├── index.routes.ts
│   ├── menu.routes.ts
│   ├── order.routes.ts
│   ├── stripe-webhook.routes.ts
│   ├── user.routes.ts
│   └── vendor.routes.ts
├── services/
│   ├── admin.service.ts
│   ├── customer-menu.service.ts
│   ├── image.service.ts
│   ├── menu.service.ts
│   ├── order.service.ts
│   ├── profile.service.ts
│   ├── stripe-webhook.service.ts
│   ├── stripe.service.ts
│   ├── transaction.service.ts
│   ├── vendor.service.ts
│   └── ...
├── scripts/
│   ├── seed-admin.ts
│   ├── seed-all.ts
│   └── migrate-menu-approval.ts
└── server.ts
```

## Required environment variables

Set values in the hosting provider; never commit real values.

| Variable | Required | Description |
| --- | --- | --- |
| `PORT` | No | HTTP port. Default `5001`. |
| `NODE_ENV` | No | `development` or `production`. |
| `MONGODB_URI` | Yes | MongoDB connection string; app uses `pizzahub` database. |
| `BETTER_AUTH_SECRET` | Yes | Better Auth secret. Use a long random value. |
| `BETTER_AUTH_URL` | Yes | Public API URL, e.g. `https://pizzahub-server-toql.onrender.com`. |
| `GOOGLE_CLIENT_ID` | For Google login | Google OAuth client ID. |
| `GOOGLE_CLIENT_SECRET` | For Google login | Google OAuth client secret. |
| `STRIPE_SECRET_KEY` | Yes | Stripe API secret key. Required at startup. |
| `STRIPE_WEBHOOK_SECRET` | For Premium checkout | Stripe signing secret for webhooks. |
| `STRIPE_PREMIUM_PRICE_ID` | For Premium checkout | Recurring Premium price ID. |
| `IMGBB_API_KEY` | For image uploads | ImgBB API key. |
| `CLIENT_URL` | Yes | Frontend origin allowed by CORS and Stripe redirects. |
| `ADMIN_NAME` / `ADMIN_EMAIL` / `ADMIN_PASSWORD` | For seeding | Demo admin account for `seed:admin`. |
| `VENDOR_NAME` / `VENDOR_EMAIL` / `VENDOR_PASSWORD` | For `seed:all` | Demo vendor account. |
| `CUSTOMER_NAME` / `CUSTOMER_EMAIL` / `CUSTOMER_PASSWORD` | For `seed:all` | Demo customer account. |

Do not expose MongoDB, Better Auth, Stripe, ImgBB, or production admin/customer/vendor secrets.

## Installation and local run

```bash
npm install
cp .env.example .env
# Fill .env values, then:
npm run dev
```

Local API: `http://localhost:5001`

## Build and production run

```bash
npm install
npm run build
npm start
```

Available scripts:

- `npm run dev`
- `npm run build`
- `npm start`
- `npm run lint` — TypeScript check without emitting files.
- `npm run seed:admin`
- `npm run seed:all`
- `npm run migrate:menu-approval`

## Authentication and roles

- Better Auth handles email/password and social auth under `/api/auth/*`.
- Protected APIs use JWT in `Authorization: Bearer <JWT>`.
- New users default to `customer` role.
- Roles: `customer`, `vendor`, `admin`.
- Blocked users rejected by session and JWT middleware.
- JWT verification uses Better Auth JWKS, issuer, and audience from `BETTER_AUTH_URL`.

Role access:

- Customer: public menu, orders, profile.
- Vendor: restaurant/menu/orders/premium.
- Admin: users/menu moderation/transactions/dashboard.

## Public API

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/` | API welcome message |
| `GET` | `/health` | MongoDB health check |
| `GET` | `/api/menu-items` | Public approved/available items with search, category, location, price, sort, pagination |
| `GET` | `/api/menu-items/categories` | Public available categories |
| `GET` | `/api/menu-items/:id` | Public approved/available item details |
| `GET` | `/api/users/me` | Authenticated user from session |
| `GET` | `/api/users/jwt-me` | Authenticated user from JWT |

Location filter example: `GET /api/menu-items?location=<real restaurant address text>`

## Customer APIs

| Method | Endpoint | Access |
| --- | --- | --- |
| `POST /api/orders` | Order creation | JWT + customer |
| `GET /api/orders/my` | Customer order history | JWT + customer |
| `GET /api/orders/:id` | Customer order details | JWT + customer |
| `PATCH /api/orders/:id/cancel` | Cancel eligible pending order | JWT + customer |

Orders require authenticated customer role and real menu items available and approved. Orders are snapshot data; deleting menu items does not erase order history.

## Vendor APIs

| Method | Endpoint | Access |
| --- | --- | --- |
| `POST /api/vendor/restaurant` | Create restaurant | JWT + vendor |
| `GET /api/vendor/restaurant` | Get own restaurant | JWT + vendor |
| `PATCH /api/vendor/restaurant` | Update own restaurant | JWT + vendor |
| `POST /api/vendor/upload-image` | ImgBB menu image upload | JWT + vendor |
| `POST /api/vendor/menu-items` | Create menu item | JWT + vendor |
| `GET /api/vendor/menu-items` | List own menu items | JWT + vendor |
| `PATCH /api/vendor/menu-items/:id` | Update own menu item | JWT + vendor |
| `DELETE /api/vendor/menu-items/:id` | Delete own menu item | JWT + vendor |
| `GET /api/vendor/orders` | List vendor orders | JWT + vendor |
| `PATCH /api/vendor/orders/:id/accept` | Accept pending order | JWT + vendor |
| `PATCH /api/vendor/orders/:id/reject` | Reject pending order | JWT + vendor |
| `PATCH /api/vendor/orders/:id/status` | Fulfillment status transition | JWT + vendor |
| `POST /api/vendor/premium/checkout` | Create Stripe Premium checkout | JWT + vendor |

Free vendors can have at most 3 active menu items. Premium vendors have unlimited active items according to subscription state.

## Admin APIs

| Method | Endpoint | Access |
| --- | --- | --- |
| `GET /api/admin/dashboard/overview` | Admin dashboard overview | JWT + admin |
| `GET /api/admin/vendors` | List vendors | JWT + admin |
| `PATCH /api/admin/users/promote-vendor` | Promote customer to vendor | JWT + admin |
| `GET /api/admin/users` | List users with search/role/status/pagination | JWT + admin |
| `GET /api/admin/users/:id` | User details | JWT + admin |
| `PATCH /api/admin/users/block` | Block user | JWT + admin |
| `PATCH /api/admin/users/unblock` | Unblock user | JWT + admin |
| `GET /api/admin/menu-items` | List menu moderation items | JWT + admin |
| `GET /api/admin/menu-items/:id` | Menu item details | JWT + admin |
| `PATCH /api/admin/menu-items/:id/approve` | Approve menu item | JWT + admin |
| `PATCH /api/admin/menu-items/:id/reject` | Reject menu item with reason | JWT + admin |
| `DELETE /api/admin/menu-items/:id` | Delete menu item | JWT + admin |
| `GET /api/admin/transactions` | List payment transactions | JWT + admin |
| `GET /api/admin/transactions/:id` | Transaction details | JWT + admin |

Admin menu moderation supports status, vendor, category, search, pagination. Approve/reject record review status; editing content resets approval; availability-only changes preserve approval.

Admin transactions support search by customer email, vendor ID, transaction/Stripe identifiers, status, type, and date range.

## User profile and image APIs

| Method | Endpoint | Access |
| --- | --- | --- |
| `GET /api/users/profile` | Get profile | JWT |
| `PATCH /api/users/profile` | Update name | JWT |
| `POST /api/users/profile/image` | Upload profile image to ImgBB | JWT |

Only `name` and image upload are supported. Email and privileged fields are read-only. Profile image upload is multipart/form-data with field `image`; response includes `user.image` and `image`.

## Stripe Premium and webhook

### Checkout

- `POST /api/vendor/premium/checkout`
- Requires authenticated vendor JWT.
- Creates Stripe Checkout session for the authenticated vendor.
- Requires `STRIPE_SECRET_KEY`, `STRIPE_PREMIUM_PRICE_ID`, and `CLIENT_URL`.
- Success redirect: `${CLIENT_URL}/vendor/premium/success?session_id={CHECKOUT_SESSION_ID}`
- Cancel redirect: `${CLIENT_URL}/vendor/premium/cancel`

### Webhook

- `POST /api/stripe/webhook`
- Uses raw body and `stripe-signature` header with `STRIPE_WEBHOOK_SECRET`.
- Handles `invoice.paid` and `invoice.payment_failed` as authoritative payment events.
- Updates subscription entitlement and persists transaction records.
- Duplicate webhook delivery is idempotent via unique Stripe invoice index.

### Transactions

`transactions` stores:

- `vendorId`, `userId`, `customerEmail`
- `stripeCustomerId`, `stripeSubscriptionId`, `stripeInvoiceId`, `stripePaymentIntentId`
- `amount` in Stripe minor units, `currency`
- `status` (`PAID`/`FAILED`), `transactionType`
- `plan`, `billingReason`, `paidAt`, `transactionDate`
- `createdAt`, `updatedAt`

Do not store card numbers, CVCs, secrets, or sensitive payment credentials.

## Database collections and relationships

Important collections:

- `user` — Better Auth users, roles, blocked state, Premium fields.
- `restaurants` — restaurant profile, address, phone.
- `menuItems` — item content, images, availability, approval status, vendor/restaurant references.
- `orders` — customer orders, items, totals, status.
- `transactions` — Stripe Premium transaction records.
- `vendorMenuLocks` — concurrency locks for vendor menu operations.

Relationships:
- `menuItems.vendorId -> user._id`
- `menuItems.restaurantId -> restaurants._id`
- `orders.customerId -> user._id`
- `orders.vendorId -> user._id`
- `orders.restaurantId -> restaurants._id`
- `restaurants.vendorId -> user._id`
- `transactions.vendorId -> user._id`

## Security notes

- Private secrets are only allowed in environment variables/hosting settings.
- No secrets are committed; `.env` is ignored.
- JWT verification is performed on every protected API call.
- Blocked users cannot access protected application APIs.
- Admin endpoints require admin role and JWT.
- Vendor endpoints require vendor role and JWT; vendors can only access their own data.
- Stripe webhook signatures are verified before processing.
- Stripe amounts/currency are taken from authoritative Stripe invoice data, not client input.

## Deployment

Recommended Render settings:

```text
Build command: npm install && npm run build
Start command: npm start
Health check path: /health
```

Deployment checklist:
- Set all required environment variables in the hosting provider.
- `BETTER_AUTH_URL` must match the deployed API URL.
- `CLIENT_URL` must match deployed frontend origin exactly.
- Configure Stripe production webhook endpoint: `https://pizzahub-server-toql.onrender.com/api/stripe/webhook`
- Verify `/health` and public menu endpoint.
- Do not make real charges in staging.
