import { firestore, COLLECTIONS, Timestamp, type ProductDoc } from "./index";

type SeedProduct = { id: string } & ProductDoc;

const SEED_PRODUCTS: SeedProduct[] = [
  {
    id: "77d49667-5193-44ef-85fe-94fdbcadbcf1",
    name: "Rose Eclipse",
    brand: "Jojo Maison",
    description:
      "A romantic floral bouquet capturing the essence of dawn-kissed roses with a modern twist. Velvety petals and warm musk make this a daily indulgence.",
    category: "Eau de Parfum",
    price: 89.0,
    sizeMl: 50,
    stock: 25,
    featured: true,
    imageUrl: "/perfumes/rose-eclipse.png",
    notes: ["Bulgarian rose", "Pink pepper", "Sandalwood", "Ambrette"],
    topNotes: "Pink pepper, Bergamot",
    heartNotes: "Bulgarian rose, Peony",
    baseNotes: "Sandalwood, Ambrette, Musk",
    createdAt: Timestamp.now(),
  },
  {
    id: "bba4483f-f170-4b39-9936-9dec82459a98",
    name: "Midnight Oud",
    brand: "Jojo Noir",
    description:
      "A deep, smoky oud crafted for evenings to remember. Rich woods are softened by sweet amber for an unmistakable signature.",
    category: "Eau de Parfum",
    price: 145.0,
    sizeMl: 75,
    stock: 12,
    featured: true,
    imageUrl: "/perfumes/midnight-oud.png",
    notes: ["Oud", "Amber", "Saffron", "Patchouli"],
    topNotes: "Saffron, Cardamom",
    heartNotes: "Oud, Rose absolute",
    baseNotes: "Amber, Patchouli, Vanilla",
    createdAt: Timestamp.now(),
  },
  {
    id: "f24be5fc-59f4-4b7d-9971-3ee5098e05f0",
    name: "Jasmine Veil",
    brand: "Jojo Maison",
    description:
      "An airy, luminous jasmine that drifts like a soft veil through your day. Bright, clean and unmistakably feminine.",
    category: "Eau de Toilette",
    price: 72.0,
    sizeMl: 50,
    stock: 30,
    featured: false,
    imageUrl: "/perfumes/jasmine-veil.png",
    notes: ["Jasmine", "White tea", "Bergamot", "Cedar"],
    topNotes: "Bergamot, White tea",
    heartNotes: "Jasmine sambac, Lily of the valley",
    baseNotes: "Cedar, White musk",
    createdAt: Timestamp.now(),
  },
  {
    id: "6d4208ac-cfc0-4c10-b400-33fb1866bfcf",
    name: "Azure Bloom",
    brand: "Jojo Atelier",
    description:
      "A bracing aquatic floral that opens with sea breeze and settles into clean musks. Effortlessly modern.",
    category: "Eau de Parfum",
    price: 110.0,
    sizeMl: 100,
    stock: 18,
    featured: true,
    imageUrl: "/perfumes/azure-bloom.png",
    notes: ["Sea salt", "Lotus", "Iris", "Driftwood"],
    topNotes: "Sea salt, Calabrian bergamot",
    heartNotes: "Lotus, Iris",
    baseNotes: "Driftwood, White musk",
    createdAt: Timestamp.now(),
  },
  {
    id: "d60dec35-c0c8-4b90-bb71-d99835981972",
    name: "Golden Amber",
    brand: "Jojo Noir",
    description:
      "Warm, resinous amber wrapped in honeyed vanilla. A cozy companion for the cooler months.",
    category: "Eau de Parfum",
    price: 98.0,
    sizeMl: 50,
    stock: 22,
    featured: false,
    imageUrl: "/perfumes/golden-amber.png",
    notes: ["Amber", "Vanilla", "Honey", "Tonka"],
    topNotes: "Mandarin, Honey",
    heartNotes: "Orange blossom, Tonka bean",
    baseNotes: "Amber, Vanilla, Benzoin",
    createdAt: Timestamp.now(),
  },
  {
    id: "721f4e93-c5a6-4baf-9af6-32852769c079",
    name: "Violet Mist",
    brand: "Jojo Atelier",
    description:
      "Powdery violets dance with iris and a whisper of soft musks for an ethereal, dreamlike trail.",
    category: "Body Mist",
    price: 38.0,
    sizeMl: 200,
    stock: 39,
    featured: false,
    imageUrl: "/perfumes/violet-mist.png",
    notes: ["Violet", "Iris", "Powdery musk"],
    topNotes: "Aldehyde, Pear",
    heartNotes: "Violet leaf, Iris pallida",
    baseNotes: "Powdery musk, Heliotrope",
    createdAt: Timestamp.now(),
  },
];

export async function seedProductsIfEmpty(): Promise<void> {
  const col = firestore.collection(COLLECTIONS.products);
  const snap = await col.limit(1).get();
  if (!snap.empty) return;

  const batch = firestore.batch();
  for (const { id, ...data } of SEED_PRODUCTS) {
    batch.set(col.doc(id), data);
  }
  await batch.commit();
}
