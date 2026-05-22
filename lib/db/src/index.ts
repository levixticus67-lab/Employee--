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
} catch {
  throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON. Paste the entire .json file contents.");
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
  coupons: "coupons",
  couponUsages: "couponUsages",
  bundles: "bundles",
  blogPosts: "blogPosts",
  stockAlerts: "stockAlerts",
  settings: "settings",
  storageFolders: "storageFolders",
  storageItems: "storageItems",
  paymentTransactions: "paymentTransactions",
} as const;

export { Timestamp };

export type ProductSize = { label: string; price: number; stock: number };

export type ProductDoc = {
  name: string; brand: string; description: string; category: string;
  collection: string | null; price: number; sizeMl: number | null;
  sizes: ProductSize[]; stock: number; featured: boolean; imageUrl: string | null;
  images: string[]; notes: string[]; topNotes: string | null; heartNotes: string | null;
  baseNotes: string | null; salePrice: number | null; saleEndsAt: string | null;
  createdAt: Timestamp;
};

export type ReviewStatus = "pending" | "approved" | "hidden";
export type ReviewDoc = {
  productId: string; customerName: string; rating: number; comment: string;
  status: ReviewStatus; createdAt: Timestamp;
};

export type OrderStatus = "pending" | "processing" | "shipped" | "delivered" | "cancelled" | "received";
export type OrderStatusHistoryEntry = { status: OrderStatus; timestamp: string };
export type OrderItemDoc = {
  productId: string; name: string; brand: string; price: number;
  quantity: number; imageUrl: string | null;
};

export type OrderDoc = {
  customerName: string; customerEmail: string; shippingAddress: string;
  buyerPhone: string | null; items: OrderItemDoc[]; subtotal: number;
  shipping: number; shippingConfirmed: boolean; freeDelivery: boolean;
  total: number; amountPaid: number;
  /** unpaid | partial | paid | pending (awaiting Pesapal) | failed (Pesapal declined) */
  paymentStatus: "unpaid" | "partial" | "paid" | "pending" | "failed";
  status: OrderStatus; statusHistory: OrderStatusHistoryEntry[];
  paymentMethod: string; paymentNumber: string | null;
  couponCode: string | null; discount: number; archived: boolean;
  /** Our merchant reference sent to Pesapal (format: jojo_{orderId}) */
  txRef: string | null;
  /** Pesapal's order_tracking_id from SubmitOrderRequest response */
  pesapalTrackingId: string | null;
  createdAt: Timestamp;
};

export type UserDoc = {
  name: string; email: string; passwordHash: string; createdAt: Timestamp;
  emailVerified?: boolean; firebaseUid?: string | null; phoneNumber?: string | null;
};
export type SessionDoc = { sid: string; data: string; expiresAt: Timestamp };

export type CouponDoc = {
  code: string; type: "percentage" | "fixed"; value: number; minOrder: number;
  active: boolean; uses: number; maxUses: number | null;
  expiryDate?: string | null; createdAt: Timestamp;
};
export type CouponUsageDoc = {
  couponId: string; userId: string; payerPhoneNumber: string; createdAt: Timestamp;
};

export type PaymentTransactionDoc = {
  orderId: string; amount: number; currency: string;
  payerPhone: string; payerName: string; payerEmail: string;
  txRef: string;
  /** Pesapal order_tracking_id */
  pesapalTrackingId: string;
  confirmationCode: string;
  status: "pending" | "completed" | "failed" | "reversed" | "invalid";
  createdAt: Timestamp; completedAt: Timestamp | null;
};

export type BundleDoc = {
  name: string; description: string; productIds: string[]; price: number;
  imageUrl: string | null; active: boolean; createdAt: Timestamp;
};
export type BlogPostDoc = {
  title: string; summary: string; content: string; imageUrl: string | null;
  author: string; published: boolean; storedInFolder: string | null; createdAt: Timestamp;
};
export type StockAlertDoc = { email: string; productId: string; productName: string; createdAt: Timestamp };
export type StorageFolderDoc = { name: string; description: string; isSystem: boolean; createdAt: Timestamp };
export type StorageItemDoc = {
  folderId: string; type: "order_log" | "blog_post"; referenceId: string;
  title: string; snapshot: Record<string, unknown>; archivedAt: Timestamp;
};

export { seedProductsIfEmpty } from "./seed";
