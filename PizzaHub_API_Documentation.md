# PizzaHub API Documentation

**Project:** PizzaHub -- Pizza Ordering & Delivery Platform\
**API Version:** 1.0\
**Backend:** Node.js, Express, TypeScript, MongoDB\
**Authentication:** Better Auth + JWT\
**Image Hosting:** ImgBB\
**Payment Integration:** Stripe

------------------------------------------------------------------------

## 1. API Base URLs

  Environment   Base URL
  ------------- ---------------------------------------------
  Local         `http://localhost:5001`
  Production    `https://pizzahub-server-toql.onrender.com`

All endpoints below are relative to the selected base URL.

## 2. Authentication

PizzaHub uses Better Auth for authentication and JWT bearer tokens for
protected application APIs.

### Authentication endpoints

  ---------------------------------------------------------------------------------
  Method            Endpoint                    Description       Access
  ----------------- --------------------------- ----------------- -----------------
  `POST`            `/api/auth/sign-up/email`   Register with     Public
                                                email and         
                                                password          

  `POST`            `/api/auth/sign-in/email`   Sign in with      Public
                                                email and         
                                                password          

  `POST`            `/api/auth/sign-out`        Sign out of the   Authenticated
                                                current session   session

  `GET`             `/api/auth/get-session`     Retrieve the      Authenticated
                                                current session   session

  `GET`             `/api/auth/token`           Obtain a JWT for  Authenticated
                                                protected API     session
                                                requests          

  `GET`             `/api/auth/jwks`            Retrieve public   Public
                                                keys used for JWT 
                                                verification      
  ---------------------------------------------------------------------------------

> Better Auth may expose additional framework-managed endpoints. The
> list above highlights the authentication operations relevant to this
> API integration.

### Authorization header

Include the JWT returned by the token endpoint when calling protected
application APIs:

``` http
Authorization: Bearer <JWT_TOKEN>
```

### User roles

  Role         Description
  ------------ -------------------------------------------------------
  `customer`   Browses the menu and manages personal orders
  `vendor`     Manages a restaurant, menu items, and incoming orders
  `admin`      Manages vendor accounts and administrative operations

Protected endpoints verify the JWT and the current user's role. Blocked
users are not permitted to access protected application APIs.

------------------------------------------------------------------------

## 3. Public Menu APIs

These endpoints do not require authentication.

  ------------------------------------------------------------------------------
  Method                  Endpoint                       Description
  ----------------------- ------------------------------ -----------------------
  `GET`                   `/api/menu-items`              Retrieve available menu
                                                         items

  `GET`                   `/api/menu-items/categories`   Retrieve available menu
                                                         categories

  `GET`                   `/api/menu-items/:id`          Retrieve details for a
                                                         menu item
  ------------------------------------------------------------------------------

### Menu listing query parameters

  ------------------------------------------------------------------------
  Parameter         Type              Description       Example
  ----------------- ----------------- ----------------- ------------------
  `q`               string            Search menu items `q=pizza`
                                      by keyword        

  `category`        string            Filter by         `category=Pizza`
                                      category          

  `minPrice`        number            Minimum price     `minPrice=300`

  `maxPrice`        number            Maximum price     `maxPrice=800`

  `sort`            string            Sort order:       `sort=price_asc`
                                      `newest`,         
                                      `price_asc`,      
                                      `price_desc`      

  `page`            number            Page number; must `page=1`
                                      be positive       

  `limit`           number            Results per page; `limit=12`
                                      maximum 50        
  ------------------------------------------------------------------------

**Example request**

``` http
GET /api/menu-items?q=pizza&category=Pizza&minPrice=300&maxPrice=800&sort=price_asc&page=1&limit=12
```

**Example response shape**

``` json
{
  "success": true,
  "menuItems": [],
  "pagination": {
    "total": 0,
    "page": 1,
    "limit": 12,
    "totalPages": 0
  }
}
```

------------------------------------------------------------------------

## 4. Customer APIs

All customer endpoints require a valid JWT for a user with the
`customer` role.

  --------------------------------------------------------------------------
  Method                  Endpoint                   Description
  ----------------------- -------------------------- -----------------------
  `POST`                  `/api/orders`              Place a new order

  `GET`                   `/api/orders/my`           Retrieve the current
                                                     customer's orders

  `GET`                   `/api/orders/:id`          Retrieve a specific
                                                     order belonging to the
                                                     customer

  `PATCH`                 `/api/orders/:id/cancel`   Cancel an eligible
                                                     pending order
  --------------------------------------------------------------------------

### Create order

**Request**

``` http
POST /api/orders
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json
```

The exact request fields should follow the deployed order controller's
validation. A typical order payload may contain menu item selections and
delivery details.

**Example response shape**

``` json
{
  "success": true,
  "message": "Order created successfully.",
  "order": {}
}
```

### Cancel order

``` http
PATCH /api/orders/:id/cancel
Authorization: Bearer <JWT_TOKEN>
```

A customer can cancel an order only when its current status permits
cancellation.

------------------------------------------------------------------------

## 5. Vendor Restaurant APIs

All vendor endpoints require a valid JWT for a user with the `vendor`
role.

  --------------------------------------------------------------------------
  Method                  Endpoint                   Description
  ----------------------- -------------------------- -----------------------
  `POST`                  `/api/vendor/restaurant`   Create the vendor's
                                                     restaurant profile

  `GET`                   `/api/vendor/restaurant`   Retrieve the vendor's
                                                     restaurant profile

  `PATCH`                 `/api/vendor/restaurant`   Update the vendor's
                                                     restaurant profile
  --------------------------------------------------------------------------

------------------------------------------------------------------------

## 6. Vendor Image Upload API

  Method   Endpoint                     Description
  -------- ---------------------------- ------------------------------
  `POST`   `/api/vendor/upload-image`   Upload a menu image to ImgBB

**Authentication:** Vendor JWT\
**Content-Type:** `multipart/form-data`\
**Form field:** `image`

### Supported image formats

-   JPG / JPEG
-   PNG
-   WEBP

**Maximum file size:** 5 MB

**Example cURL request**

``` bash
curl -X POST "https://pizzahub-server-toql.onrender.com/api/vendor/upload-image" \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -F "image=@pizza.jpg"
```

**Successful response shape**

``` json
{
  "success": true,
  "message": "Image uploaded successfully.",
  "image": {
    "id": "IMGBB_IMAGE_ID",
    "title": "pizza",
    "imageUrl": "https://...",
    "displayUrl": "https://...",
    "size": 123456
  }
}
```

The image upload integration is implemented, but the latest local test
returned HTTP `502`. Confirm a successful upload in the target
environment before relying on it in production.

------------------------------------------------------------------------

## 7. Vendor Menu Management APIs

All endpoints require a vendor JWT. Vendors can manage only their own
menu items.

  Method     Endpoint                       Description
  ---------- ------------------------------ ----------------------------------
  `POST`     `/api/vendor/menu-items`       Create a menu item
  `GET`      `/api/vendor/menu-items`       Retrieve the vendor's menu items
  `PATCH`    `/api/vendor/menu-items/:id`   Update a menu item
  `DELETE`   `/api/vendor/menu-items/:id`   Delete a menu item

### Create menu item

**Request**

``` http
POST /api/vendor/menu-items
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json
```

**Example body**

``` json
{
  "name": "Chicken BBQ Pizza",
  "description": "BBQ chicken with mozzarella cheese.",
  "category": "Pizza",
  "price": 650,
  "imageUrl": "https://example.com/pizza.jpg",
  "imageId": "IMGBB_IMAGE_ID",
  "isAvailable": true
}
```

**Validation notes**

-   `name`, `description`, `category`, `imageUrl`, and `imageId` must be
    non-empty strings.
-   `price` must be a positive number.
-   `imageUrl` must be a valid HTTPS URL.
-   `isAvailable`, when provided, must be a boolean.

### Update menu item

Use `PATCH /api/vendor/menu-items/:id` with one or more supported
fields:

-   `name`
-   `description`
-   `category`
-   `price`
-   `imageUrl`
-   `imageId`
-   `isAvailable`

### Delete menu item

``` http
DELETE /api/vendor/menu-items/:id
Authorization: Bearer <JWT_TOKEN>
```

------------------------------------------------------------------------

## 8. Vendor Order Management APIs

All endpoints require a vendor JWT. Vendors can manage orders associated
with their restaurant.

  ---------------------------------------------------------------------------------
  Method                  Endpoint                          Description
  ----------------------- --------------------------------- -----------------------
  `GET`                   `/api/vendor/orders`              Retrieve incoming
                                                            vendor orders

  `PATCH`                 `/api/vendor/orders/:id/accept`   Accept an order

  `PATCH`                 `/api/vendor/orders/:id/reject`   Reject an order

  `PATCH`                 `/api/vendor/orders/:id/status`   Update an order's
                                                            fulfillment status
  ---------------------------------------------------------------------------------

### Reject order

**Example body**

``` json
{
  "rejectionReason": "Currently unable to process this order."
}
```

### Update order status

**Example body**

``` json
{
  "status": "PREPARING"
}
```

Order statuses observed during API testing include:

-   `CONFIRMED`
-   `PREPARING`
-   `OUT_FOR_DELIVERY`
-   `DELIVERED`
-   `REJECTED`
-   `CANCELLED`

The API enforces its own allowed status transitions.

------------------------------------------------------------------------

## 9. Vendor Premium Checkout API

  --------------------------------------------------------------------------------
  Method                  Endpoint                         Description
  ----------------------- -------------------------------- -----------------------
  `POST`                  `/api/vendor/premium/checkout`   Create a Stripe Premium
                                                           checkout session

  --------------------------------------------------------------------------------

**Authentication:** Vendor JWT

The checkout endpoint is present in the vendor route configuration.
Confirm the Stripe checkout and verified webhook lifecycle in the target
environment before treating subscription activation as production-ready.

------------------------------------------------------------------------

## 10. Vendor Signup Requests

A customer applies to become a vendor. The role is changed only when an admin
approves the request, so client-supplied roles are never trusted.

  -------------------------------------------------------------------------------------
  Method                  Endpoint                          Description
  ----------------------- --------------------------------- ----------------------------
  `POST`                  `/api/vendor-requests`            Submit an application
                                                             (JWT + customer)

  `GET`                   `/api/vendor-requests/me`         Get own latest request
                                                             (JWT)

  `GET`                   `/api/admin/vendor-requests`      List applications
                                                             (JWT + admin)

  `GET`                   `/api/admin/vendor-requests/:id`  Application details
                                                             (JWT + admin)

  `PATCH`                 `/api/admin/vendor-requests/:id/approve`
                                                             Approve and grant vendor
                                                             role (JWT + admin)

  `PATCH`                 `/api/admin/vendor-requests/:id/reject`
                                                             Reject with reason
                                                             (JWT + admin)
  -------------------------------------------------------------------------------------

`POST /api/vendor-requests` accepts `{ "restaurantName": string, "message"?: string }`.
Restaurant name must be 2–120 characters; message must be at most 500 characters.
The applicant identity is read from the JWT. A pending application blocks
duplicates (409); rejected applicants may apply again. Applications are stored in
the `vendorRequests` collection with status `PENDING`, `APPROVED`, or `REJECTED`
and optional `reviewedAt`, `reviewedBy`, and `rejectionReason`.

`GET /api/admin/vendor-requests` supports `status`, `q`, `page`, and `limit`.
Reject requires `rejectionReason` (3–300 characters). Approve is the trusted
server path that sets `role: "vendor"` on the applicant's user record.

------------------------------------------------------------------------

## 11. Admin APIs

All endpoints require a valid JWT for a user with the `admin` role.

  -----------------------------------------------------------------------------------
  Method                  Endpoint                            Description
  ----------------------- ----------------------------------- -----------------------
  `GET`                   `/api/admin/vendors`                Retrieve vendor
                                                              accounts

  `PATCH`                 `/api/admin/users/promote-vendor`   Promote a user to
                                                              vendor

  `PATCH`                 `/api/admin/users/block`            Block a user

  `PATCH`                 `/api/admin/users/unblock`          Unblock a user
  -----------------------------------------------------------------------------------

------------------------------------------------------------------------

## 12. Common HTTP Status Codes

  -----------------------------------------------------------------------
  Status                              Meaning
  ----------------------------------- -----------------------------------
  `200 OK`                            Request completed successfully

  `201 Created`                       Resource created successfully

  `400 Bad Request`                   Invalid input or request data

  `401 Unauthorized`                  Missing, invalid, or expired
                                      authentication

  `403 Forbidden`                     Authenticated user lacks the
                                      required role or permission

  `404 Not Found`                     Requested resource does not exist
                                      or is inaccessible

  `500 Internal Server Error`         Unexpected server-side error

  `502 Bad Gateway`                   Upstream service, such as image
                                      hosting, failed
  -----------------------------------------------------------------------

Responses generally include a `success` boolean and a descriptive
`message`. Successful resource operations may also return the relevant
resource.

------------------------------------------------------------------------

## 13. Integration Notes

1.  Use the production base URL for production integration and the local
    base URL during development.
2.  Obtain a JWT through the authenticated session flow before calling
    protected APIs.
3.  Send the JWT in the `Authorization: Bearer` header.
4.  Keep customer, vendor, and admin features separated according to the
    user's role.
5.  Upload menu images using the image upload endpoint and use the
    returned image URL and image ID when creating or updating menu
    items.
6.  Do not expose secret keys, database credentials, JWT secrets, or
    Stripe secrets in frontend code.
7.  Do not assume an endpoint or business rule is available unless it is
    listed in this document and verified in the target environment.

## 14. API Coverage Notes

The endpoint list above documents the application routes currently
identified in the backend route configuration. Some assignment-level
workflows---such as admin menu moderation, dashboard statistics,
transaction listing, profile management, and subscription
cancellation/status---are not included as available endpoints because
their route implementations have not yet been confirmed.

The image upload endpoint also requires a successful end-to-end test
against ImgBB.

------------------------------------------------------------------------

**PizzaHub Backend API Documentation**\
Prepared for frontend integration.
