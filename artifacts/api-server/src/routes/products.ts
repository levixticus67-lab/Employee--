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
  collection: string | null;
  price: number;
  sizeMl: number | null;
  sizes: { label: string; price: number; stock: number }[];
  stock: number;
  featured: boolean;
  imageUrl: string | null;
  images: string[];
  notes: string[];
  topNotes: string | null;
  heartNotes: string | null;
  baseNotes: string | null;
  salePrice: number | null;
  saleEndsAt: string | null;
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
  filters: { category?: string; search?: string; featured?: boolean; collection?: string; minPrice?: number; maxPrice?: number } = {},
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
      collection: p.collection ?? null,
      price: Number(p.price),
      sizeMl: p.sizeMl ?? null,
      sizes: p.sizes ?? [],
      stock: p.stock,
      featured: p.featured,
      imageUrl: p.imageUrl ?? null,
      images: p.images ?? [],
      notes: p.notes ?? [],
      topNotes: p.topNotes ?? null,
      heartNotes: p.heartNotes ?? null,
      baseNotes: p.baseNotes ?? null,
      salePrice: p.salePrice ?? null,
      saleEndsAt: p.saleEndsAt ?? null,
      averageRating: stats ? stats.sum / stats.count : null,
      reviewCount: stats?.count ?? 0,
      createdAt: tsToIso(p.createdAt),
    };
  });

  if (filters.category) {
    products = products.filter((p) => p.category === filters.category);
  }
  if (filters.collection) {
    products = products.filter((p) => p.collection === filters.collection);
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
  if (filters.minPrice !== undefined) {
    products = products.filter((p) => p.price >= filters.minPrice!);
  }
  if (filters.maxPrice !== undefined) {
    products = products.filter((p) => p.price <= filters.maxPrice!);
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
  const minPrice = req.query["minPrice"] ? Number(req.query["minPrice"]) : undefined;
  const maxPrice = req.query["maxPrice"] ? Number(req.query["maxPrice"]) : undefined;
  const collection = typeof req.query["collection"] === "string" ? req.query["collection"] : undefined;
  const data = await loadProductsWithStats({ ...parsed.data, minPrice, maxPrice, collection });
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

router.get("/products/flash-sales", async (_req, res) => {
  const all = await loadProductsWithStats({});
  const now = new Date().toISOString();
  const flash = all.filter((p) => p.salePrice !== null && (p.saleEndsAt === null || p.saleEndsAt > now));
  res.json(flash);
});

router.get("/products/collections", async (_req, res) => {
  const snap = await firestore.collection(COLLECTIONS.products).get();
  const collections = new Set<string>();
  for (const doc of snap.docs) {
    const p = doc.data() as ProductDoc;
    if (p.collection) collections.add(p.collection);
  }
  res.json(Array.from(collections).sort());
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

router.get("/products/:id/related", async (req, res) => {
  const all = await loadProductsWithStats({});
  const product = all.find((p) => p.id === req.params.id);
  if (!product) {
    res.status(404).json({ error: "Product not found" });
    return;
  }
  const related = all
    .filter((p) => p.id !== product.id && (p.category === product.category || p.collection === product.collection))
    .slice(0, 4);
  res.json(related);
});

export default router;
