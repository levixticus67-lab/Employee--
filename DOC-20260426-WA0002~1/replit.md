# Workspace

## Overview

Jojo Collections — a perfume e-commerce app with a customer storefront and admin panel, built on a pnpm workspace monorepo. The visual direction is glassmorphism in blue throughout.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **Frontend**: React + Vite + Tailwind v4 + shadcn/ui + wouter + sonner
- **API framework**: Express 5
- **Database**: Google Firebase Firestore (via `firebase-admin` server SDK)
- **Validation**: Zod
- **API codegen**: Orval (from OpenAPI spec)
- **Object storage**: Replit App Storage (GCS) via presigned URLs

## Artifacts

- `artifacts/jojo-collections` — customer + admin web UI (preview path `/`, port 18316)
- `artifacts/api-server` — Express API serving `/api/*` (port 8080)
- `artifacts/mockup-sandbox` — design canvas

## Domain Model (Firestore collections)

- `products` — perfume catalog (notes as array, top/heart/base notes, price, stock, featured flag)
- `orders` — checkout records with embedded `items` array. Stock decrement happens in a Firestore transaction
- `reviews` — pending/approved/hidden moderation status
- `users` — customer accounts (bcrypt-hashed passwords)
- `sessions` — express-session backing store (custom Firestore-backed Store in `artifacts/api-server/src/middlewares/session.ts`)

The Firebase service account JSON is read from the `FIREBASE_SERVICE_ACCOUNT_JSON` secret. Admin SDK is initialized in `lib/db/src/index.ts` with `ignoreUndefinedProperties: true`.

On startup the API server calls `seedProductsIfEmpty()` which writes 6 demo perfumes to Firestore only if the `products` collection is empty.

## Auth

- Customer auth: email + password with bcrypt, session cookie (`jojo.sid`).
- Admin auth: single shared password from `ADMIN_PASSWORD` secret. Sets `session.isAdmin = true`.
- All `/api/admin/*` routes (except `/api/admin/auth/*`) and `/api/storage/uploads/*` require admin session.
- `customFetch` sends `credentials: "include"` so the browser ships the session cookie.

## Application Routes

Customer: `/`, `/shop`, `/product/:id`, `/cart`, `/checkout`, `/order/:id`, `/login`, `/signup`
Admin: `/admin/login`, `/admin`, `/admin/products`, `/admin/orders`, `/admin/reviews` (all guarded)

## Checkout

Simplified to three fields: full name, email, shipping address (free-form textarea). When the customer is logged in, name and email are auto-populated from their account. No phone, no city, no notes.

## Required Secrets

- `FIREBASE_SERVICE_ACCOUNT_JSON` — full JSON from Firebase Console > Project Settings > Service Accounts > Generate new private key
- `SESSION_SECRET` — random string used by express-session
- `ADMIN_PASSWORD` — admin dashboard password
- `DEFAULT_OBJECT_STORAGE_BUCKET_ID`, `PRIVATE_OBJECT_DIR`, `PUBLIC_OBJECT_SEARCH_PATHS` — for product image uploads

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from `lib/api-spec/openapi.yaml`

## Codegen Notes

- `lib/api-zod` barrel exports zod schemas at top level and TS interfaces under the `Types` namespace, because both share names. Consume zod schemas as `import { Foo } from "@workspace/api-zod"`.
- Orval names review-create body as `CreateProductReviewBody` (operation-prefixed), not `CreateReviewBody`.

## Object Storage

Server libs in `artifacts/api-server/src/lib/`. Client lib in `lib/object-storage-web` (Uppy v5). Admin product images upload via `ObjectUploader` and store as `/api/storage{objectPath}` in `products.imageUrl`.

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
