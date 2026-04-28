import { Timestamp, type Firestore } from "firebase-admin/firestore";
export declare const firestore: Firestore;
export declare const COLLECTIONS: {
    readonly products: "products";
    readonly orders: "orders";
    readonly reviews: "reviews";
    readonly users: "users";
    readonly sessions: "sessions";
};
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
//# sourceMappingURL=index.d.ts.map