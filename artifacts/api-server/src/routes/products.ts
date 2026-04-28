import { Router, type IRouter } from "express";
import { firestore, COLLECTIONS, type ProductDoc, type ReviewDoc, Timestamp } from "@workspace/db";
import { ListProductsQueryParams } from "@workspace/api-zod";

const router: IRouter = Router();

type ProductDto = {
  id: string;
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
  averageRating: number | null;
  reviewCount: number;
  createdAt: string;
};

function tsToIso(value: unknown): string {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  return new Date().toISOString();
}

async function loadProductsWithStats(
  filters: { category?: string; search?: string; featured?: boolean } = {},
  limit?: number,
  orderByCreated: "asc" | "desc" = "desc",
): Promise<ProductDto[]> {
  const productsCol = firestore.collection(COLLECTIONS.products);
  const productsSnap = await productsCol.get();

  const reviewsSnap = await firestore
    .collection(COLLECTIONS.reviews)
    .where("status", "==", "approved")
    .get();

  const ratingsByProduct = new Map<string, { sum: number; count: number }>();
  for (const doc of reviewsSnap.docs) {
    const r = doc.data() as ReviewDoc;
    const cur = ratingsByProduct.get(r.productId) ?? { sum: 0, count: 0 };
    cur.sum += r.rating;
    cur.count += 1;
    ratingsByProduct.set(r.productId, cur);
  }

  let products: ProductDto[] = productsSnap.docs.map((doc) => {
    const p = doc.data() as ProductDoc;
    const stats = ratingsByProduct.get(doc.id);
    return {
      id: doc.id,
      name: p.name,
      brand: p.brand,
      description: p.description,
      category: p.category,
      price: Number(p.price),
      sizeMl: p.sizeMl ?? null,
      stock: p.stock,
      featured: p.featured,
      imageUrl: p.imageUrl ?? null,
      notes: p.notes ?? [],
      topNotes: p.topNotes ?? null,
      heartNotes: p.heartNotes ?? null,
      baseNotes: p.baseNotes ?? null,
      averageRating: stats ? stats.sum / stats.count : null,
      reviewCount: stats?.count ?? 0,
      createdAt: tsToIso(p.createdAt),
    };
  });

  if (filters.category) {
    products = products.filter((p) => p.category === filters.category);
  }
  if (filters.featured !== undefined) {
    products = products.filter((p) => p.featured === filters.featured);
  }
  if (filters.search) {
    const term = filters.search.toLowerCase();
    products = products.filter(
      (p) =>
        p.name.toLowerCase().includes(term) ||
        p.brand.toLowerCase().includes(term) ||
        p.description.toLowerCase().includes(term),
    );
  }

  products.sort((a, b) =>
    orderByCreated === "desc"
      ? b.createdAt.localeCompare(a.createdAt)
      : a.createdAt.localeCompare(b.createdAt),
  );

  if (limit) products = products.slice(0, limit);

  return products;
}

export { loadProductsWithStats };

router.get("/products", async (req, res) => {
  const parsed = ListProductsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid query parameters" });
    return;
  }
  const data = await loadProductsWithStats(parsed.data);
  res.json(data);
});

router.get("/products/featured", async (_req, res) => {
  const data = await loadProductsWithStats({ featured: true }, 8);
  res.json(data);
});

router.get("/products/new-arrivals", async (_req, res) => {
  const data = await loadProductsWithStats({}, 8, "desc");
  res.json(data);
});

router.get("/products/:id", async (req, res) => {
  const all = await loadProductsWithStats({});
  const item = all.find((p) => p.id === req.params.id);
  if (!item) {
    res.status(404).json({ error: "Product not found" });
    return;
  }
  res.json(item);
});

export default router;
