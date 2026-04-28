import { initializeApp, cert, getApps, type App } from "firebase-admin/app";
import { getFirestore, Timestamp, type Firestore } from "firebase-admin/firestore";

const serviceAccountJson = process.env["FIREBASE_SERVICE_ACCOUNT_JSON"];
if (!serviceAccountJson) {
  throw new Error(
    "FIREBASE_SERVICE_ACCOUNT_JSON must be set. Paste the JSON file contents from Firebase Console > Project Settings > Service Accounts > Generate new private key.",
  );
}

let parsedServiceAccount: Record<string, string>;
try {
  parsedServiceAccount = JSON.parse(serviceAccountJson);
} catch (err) {
  throw new Error(
    "FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON. Paste the entire .json file contents.",
  );
}

if (parsedServiceAccount["private_key"]) {
  parsedServiceAccount["private_key"] = parsedServiceAccount["private_key"].replace(/\\n/g, "\n");
}

let app: App;
if (getApps().length) {
  app = getApps()[0]!;
} else {
  app = initializeApp({
    credential: cert({
      projectId: parsedServiceAccount["project_id"],
      clientEmail: parsedServiceAccount["client_email"],
      privateKey: parsedServiceAccount["private_key"],
    }),
  });
}

export const firestore: Firestore = getFirestore(app);
firestore.settings({ ignoreUndefinedProperties: true });

export const COLLECTIONS = {
  products: "products",
  orders: "orders",
  reviews: "reviews",
  users: "users",
  sessions: "sessions",
} as const;

export { Timestamp };

export type ProductDoc = {
  name: string;
  brand: string;
  description: string;
  category: string;
  price: number;
  sizeMl: number | null;
  stock: number;
  featured: boolean;
  imageUrl: string | null;
  notes: string[];
  topNotes: string | null;
  heartNotes: string | null;
  baseNotes: string | null;
  createdAt: Timestamp;
};

export type ReviewStatus = "pending" | "approved" | "hidden";
export type ReviewDoc = {
  productId: string;
  customerName: string;
  rating: number;
  comment: string;
  status: ReviewStatus;
  createdAt: Timestamp;
};

export type OrderStatus = "pending" | "processing" | "shipped" | "delivered" | "cancelled";
export type OrderItemDoc = {
  productId: string;
  name: string;
  brand: string;
  price: number;
  quantity: number;
  imageUrl: string | null;
};
export type OrderDoc = {
  customerName: string;
  customerEmail: string;
  shippingAddress: string;
  items: OrderItemDoc[];
  subtotal: number;
  shipping: number;
  total: number;
  status: OrderStatus;
  createdAt: Timestamp;
};

export type UserDoc = {
  name: string;
  email: string;
  passwordHash: string;
  createdAt: Timestamp;
};

export type SessionDoc = {
  sid: string;
  data: string;
  expiresAt: Timestamp;
};

export { seedProductsIfEmpty } from "./seed";
