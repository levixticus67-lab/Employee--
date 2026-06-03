import { useState, useEffect } from "react";
import { AdminLayout } from "@/components/admin-layout";
import { useListProducts, useCreateProduct, useUpdateProduct, useDeleteProduct, Product } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Plus, Edit2, Trash2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { apiFetch } from "@/lib/api";

const CATEGORIES = ["Eau de Parfum", "Eau de Toilette", "Body Mist"];

type Size = { label: string; price: number; stock: number };

async function uploadToCloudinary(file: File): Promise<string | null> {
  const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
  const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;
  if (!cloudName || !uploadPreset) { toast.error("Cloudinary not configured"); return null; }
  const data = new FormData();
  data.append("file", file);
  data.append("upload_preset", uploadPreset);
  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, { method: "POST", body: data });
  const json = await res.json();
  return json.secure_url ?? null;
}

export default function AdminProducts() {
  const { data: products, refetch, isLoading } = useListProducts();
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const deleteProduct = useDeleteProduct();
  const [collections, setCollections] = useState<string[]>([]);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [activeTab, setActiveTab] = useState<"basic" | "notes" | "advanced">("basic");
  const [uploadingExtra, setUploadingExtra] = useState(false);

  useEffect(() => {
    apiFetch("/api/products/collections").then((r) => r.json()).then(setCollections).catch(() => {});
  }, []);

  const initialFormState = {
    name: "", brand: "", description: "", category: CATEGORIES[0]!, price: 0, sizeMl: 0, stock: 10,
    featured: false, imageUrl: "", notes: [] as string[], topNotes: "", heartNotes: "", baseNotes: "",
    collection: "", salePrice: "", saleEndsAt: "",
    sizes: [] as Size[], images: [] as string[],
  };

  const [form, setForm] = useState(initialFormState);
  const [notesInput, setNotesInput] = useState("");
  const [newSizeLabel, setNewSizeLabel] = useState("");
  const [newSizePrice, setNewSizePrice] = useState("");
  const [newSizeStock, setNewSizeStock] = useState("");
  const [newCollection, setNewCollection] = useState("");

  const handleOpenCreate = () => {
    setEditingProduct(null);
    setForm(initialFormState);
    setNotesInput("");
    setActiveTab("basic");
    setIsFormOpen(true);
  };

  const handleOpenEdit = (product: any) => {
    setEditingProduct(product);
    setForm({
      name: product.name, brand: product.brand, description: product.description,
      category: product.category, price: product.price, sizeMl: product.sizeMl || 0,
      stock: product.stock, featured: product.featured, imageUrl: product.imageUrl || "",
      notes: product.notes || [], topNotes: product.topNotes || "", heartNotes: product.heartNotes || "",
      baseNotes: product.baseNotes || "", collection: product.collection || "",
      salePrice: product.salePrice ? String(product.salePrice) : "",
      saleEndsAt: product.saleEndsAt ? product.saleEndsAt.slice(0, 16) : "",
      sizes: product.sizes || [], images: product.images || [],
    });
    setNotesInput(product.notes?.join(", ") || "");
    setActiveTab("basic");
    setIsFormOpen(true);
  };

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this product?")) {
      deleteProduct.mutate({ id }, {
        onSuccess: () => { toast.success("Product deleted"); refetch(); },
        onError: () => toast.error("Failed to delete product"),
      });
    }
  };

  const addSize = () => {
    if (!newSizeLabel || !newSizePrice) return;
    setForm((prev) => ({
      ...prev,
      sizes: [...prev.sizes, { label: newSizeLabel, price: Number(newSizePrice), stock: Number(newSizeStock) || 0 }],
    }));
    setNewSizeLabel(""); setNewSizePrice(""); setNewSizeStock("");
  };

  const handleExtraImages = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setUploadingExtra(true);
    let count = 0;
    for (const file of files) {
      const url = await uploadToCloudinary(file);
      if (url) { setForm((prev) => ({ ...prev, images: [...prev.images, url] })); count++; }
    }
    if (count > 0) toast.success(`${count} image${count > 1 ? "s" : ""} uploaded`);
    else toast.error("Upload failed");
    setUploadingExtra(false);
    e.target.value = "";
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      ...form,
      notes: notesInput.split(",").map((n) => n.trim()).filter(Boolean),
      salePrice: form.salePrice ? Number(form.salePrice) : null,
      saleEndsAt: form.saleEndsAt ? new Date(form.saleEndsAt).toISOString() : null,
      collection: form.collection || null,
    };

    if (editingProduct) {
      updateProduct.mutate({ id: editingProduct.id, data: payload as any }, {
        onSuccess: () => { toast.success("Product updated"); setIsFormOpen(false); refetch(); },
        onError: () => toast.error("Failed to update product"),
      });
    } else {
      createProduct.mutate({ data: payload as any }, {
        onSuccess: () => { toast.success("Product created"); setIsFormOpen(false); refetch(); },
        onError: () => toast.error("Failed to create product"),
      });
    }
  };

  return (
    <AdminLayout>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-serif text-blue-950 mb-2">Products</h1>
          <p className="text-blue-900/70">Manage your fragrance catalog</p>
        </div>
        <Button onClick={handleOpenCreate} className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-lg shadow-blue-600/20">
          <Plus className="w-4 h-4 mr-2" /> Add Product
        </Button>
      </div>

      <div className="glass-panel-heavy rounded-3xl border-white/50 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-white/20 border-b border-white/30">
              <tr>
                {["Product", "Category", "Collection", "Price", "Stock", "Actions"].map((h) => (
                  <th key={h} className="px-6 py-4 text-sm font-medium text-blue-950">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/20">
              {isLoading ? (
                <tr><td colSpan={6} className="px-6 py-8 text-center text-blue-800">Loading...</td></tr>
              ) : products?.length === 0 ? (
                <tr><td colSpan={6} className="px-6 py-8 text-center text-blue-800">No products found.</td></tr>
              ) : (
                products?.map((product: any) => (
                  <tr key={product.id} className="hover:bg-white/10 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 glass-card rounded p-1 flex-shrink-0">
                          {product.imageUrl ? (
                            <img src={product.imageUrl} alt={product.name} className="w-full h-full object-contain" />
                          ) : (
                            <div className="w-full h-full bg-white/20 rounded flex items-center justify-center text-[10px] text-blue-400">Img</div>
                          )}
                        </div>
                        <div>
                          <p className="font-medium text-blue-950">{product.name}</p>
                          <p className="text-xs text-blue-800/70">{product.brand}</p>
                          {product.salePrice && <p className="text-xs text-orange-600 font-medium">Sale: ${product.salePrice}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-blue-900">{product.category}</td>
                    <td className="px-6 py-4 text-sm text-blue-900">{product.collection || <span className="text-blue-400 italic">—</span>}</td>
                    <td className="px-6 py-4 text-sm font-medium text-blue-950">${product.price.toFixed(2)}</td>
                    <td className="px-6 py-4">
                      <span className={`text-xs px-2 py-1 rounded-full ${product.stock > 10 ? "bg-green-400/20 text-green-200" : product.stock > 0 ? "bg-orange-400/20 text-orange-200" : "bg-red-400/20 text-red-300"}`}>
                        {product.stock} in stock
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2">
                        <button onClick={() => handleOpenEdit(product)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"><Edit2 className="w-4 h-4" /></button>
                        <button onClick={() => handleDelete(product.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-3xl glass-panel-heavy border-white/50 shadow-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-serif text-blue-950">
              {editingProduct ? "Edit Product" : "New Product"}
            </DialogTitle>
          </DialogHeader>

          <div className="flex gap-2 border-b border-white/20 pb-3 mt-4">
            {(["basic", "notes", "advanced"] as const).map((tab) => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all capitalize ${activeTab === tab ? "bg-blue-600 text-white" : "glass-card text-blue-900 hover:bg-white/40"}`}>
                {tab === "basic" ? "Basic Info" : tab === "notes" ? "Fragrance Notes" : "Advanced"}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-5 mt-2">
            {activeTab === "basic" && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-blue-900/80 mb-1">Name</label>
                    <input required type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full glass-card rounded-lg px-3 py-2 text-blue-950 border-white/40 focus:ring-2 focus:ring-blue-400 focus:outline-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-blue-900/80 mb-1">Brand</label>
                    <input required type="text" value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} className="w-full glass-card rounded-lg px-3 py-2 text-blue-950 border-white/40 focus:ring-2 focus:ring-blue-400 focus:outline-none" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-blue-900/80 mb-1">Category</label>
                    <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="w-full glass-card rounded-lg px-3 py-2 text-blue-950 border-white/40 focus:ring-2 focus:ring-blue-400 focus:outline-none">
                      {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-blue-900/80 mb-1">Collection</label>
                    <div className="flex gap-2">
                      <select value={form.collection} onChange={(e) => setForm({ ...form, collection: e.target.value })} className="flex-1 glass-card rounded-lg px-3 py-2 text-blue-950 border-white/40 focus:ring-2 focus:ring-blue-400 focus:outline-none">
                        <option value="">None</option>
                        {collections.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                      <input type="text" value={newCollection} onChange={(e) => setNewCollection(e.target.value)} placeholder="New..."
                        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (newCollection) { setForm({ ...form, collection: newCollection }); setCollections((p) => [...p, newCollection]); setNewCollection(""); } } }}
                        className="w-24 glass-card rounded-lg px-2 py-2 text-blue-950 border-white/40 focus:ring-2 focus:ring-blue-400 focus:outline-none text-sm" />
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-blue-900/80 mb-1">Price ($)</label>
                    <input required type="number" min="0" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })} className="w-full glass-card rounded-lg px-3 py-2 text-blue-950 border-white/40 focus:ring-2 focus:ring-blue-400 focus:outline-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-blue-900/80 mb-1">Size (ml)</label>
                    <input type="number" min="0" value={form.sizeMl} onChange={(e) => setForm({ ...form, sizeMl: Number(e.target.value) })} className="w-full glass-card rounded-lg px-3 py-2 text-blue-950 border-white/40 focus:ring-2 focus:ring-blue-400 focus:outline-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-blue-900/80 mb-1">Stock</label>
                    <input required type="number" min="0" value={form.stock} onChange={(e) => setForm({ ...form, stock: Number(e.target.value) })} className="w-full glass-card rounded-lg px-3 py-2 text-blue-950 border-white/40 focus:ring-2 focus:ring-blue-400 focus:outline-none" />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="featured" checked={form.featured} onChange={(e) => setForm({ ...form, featured: e.target.checked })} className="w-4 h-4 text-blue-600 rounded" />
                  <label htmlFor="featured" className="text-sm font-medium text-blue-900/80">Feature on homepage</label>
                </div>
                <div>
                  <label className="block text-sm font-medium text-blue-900/80 mb-1">Description</label>
                  <textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full glass-card rounded-lg px-3 py-2 text-blue-950 border-white/40 focus:ring-2 focus:ring-blue-400 focus:outline-none resize-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-blue-900/80 mb-1">Main Image</label>
                  <div className="flex gap-4 items-center">
                    {form.imageUrl && (
                      <div className="w-16 h-16 glass-card rounded p-1 flex-shrink-0 bg-white/40">
                        <img src={form.imageUrl} alt="Preview" className="w-full h-full object-contain" />
                      </div>
                    )}
                    <label className="flex items-center gap-2 px-4 py-2 glass-card rounded-lg text-sm text-blue-900 hover:bg-white/40 cursor-pointer">
                      <Upload className="w-4 h-4" /> {form.imageUrl ? "Change" : "Upload Image"}
                      <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                        const file = e.target.files?.[0]; if (!file) return;
                        const url = await uploadToCloudinary(file);
                        if (url) { setForm({ ...form, imageUrl: url }); toast.success("Image uploaded"); }
                        e.target.value = "";
                      }} />
                    </label>
                    {form.imageUrl && (
                      <button type="button" onClick={() => setForm({ ...form, imageUrl: "" })} className="text-xs text-red-500 hover:text-red-700">Remove</button>
                    )}
                  </div>
                </div>
              </>
            )}

            {activeTab === "notes" && (
              <>
                {[
                  { field: "topNotes" as const, label: "Top Notes" },
                  { field: "heartNotes" as const, label: "Heart Notes" },
                  { field: "baseNotes" as const, label: "Base Notes" },
                ].map(({ field, label }) => (
                  <div key={field}>
                    <label className="block text-sm font-medium text-blue-900/80 mb-1">{label}</label>
                    <input type="text" value={form[field]} onChange={(e) => setForm({ ...form, [field]: e.target.value })} className="w-full glass-card rounded-lg px-3 py-2 text-blue-950 border-white/40 focus:ring-2 focus:ring-blue-400 focus:outline-none" />
                  </div>
                ))}
                <div>
                  <label className="block text-sm font-medium text-blue-900/80 mb-1">All Notes (comma-separated)</label>
                  <input type="text" value={notesInput} onChange={(e) => setNotesInput(e.target.value)} placeholder="e.g. Vanilla, Rose, Musk" className="w-full glass-card rounded-lg px-3 py-2 text-blue-950 border-white/40 focus:ring-2 focus:ring-blue-400 focus:outline-none" />
                </div>
              </>
            )}

            {activeTab === "advanced" && (
              <>
                <div className="glass-panel rounded-xl p-4 border-white/30">
                  <h3 className="font-medium text-blue-950 mb-3 text-sm uppercase tracking-wider">Flash Sale</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-blue-900/70 mb-1">Sale Price ($)</label>
                      <input type="number" min="0" step="0.01" value={form.salePrice} onChange={(e) => setForm({ ...form, salePrice: e.target.value })} placeholder="Leave empty to disable" className="w-full glass-card rounded-lg px-3 py-2 text-blue-950 border-white/40 focus:ring-2 focus:ring-blue-400 focus:outline-none text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs text-blue-900/70 mb-1">Sale Ends At</label>
                      <input type="datetime-local" value={form.saleEndsAt} onChange={(e) => setForm({ ...form, saleEndsAt: e.target.value })} className="w-full glass-card rounded-lg px-3 py-2 text-blue-950 border-white/40 focus:ring-2 focus:ring-blue-400 focus:outline-none text-sm" />
                    </div>
                  </div>
                </div>

                <div className="glass-panel rounded-xl p-4 border-white/30">
                  <h3 className="font-medium text-blue-950 mb-3 text-sm uppercase tracking-wider">Size Variants</h3>
                  {form.sizes.length > 0 && (
                    <div className="space-y-2 mb-3">
                      {form.sizes.map((size, i) => (
                        <div key={i} className="flex items-center gap-2 glass-card rounded-lg px-3 py-2 text-sm">
                          <span className="font-medium text-blue-950 flex-1">{size.label}</span>
                          <span className="text-blue-800/70">${size.price}</span>
                          <span className="text-blue-800/50">{size.stock} in stock</span>
                          <button type="button" onClick={() => setForm((prev) => ({ ...prev, sizes: prev.sizes.filter((_, j) => j !== i) }))} className="text-red-500 hover:text-red-700">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="grid grid-cols-3 gap-2">
                    <input type="text" value={newSizeLabel} onChange={(e) => setNewSizeLabel(e.target.value)} placeholder="Label (e.g. 50ml)" className="glass-card rounded-lg px-2 py-1.5 text-sm text-blue-950 border-white/40 focus:outline-none focus:ring-1 focus:ring-blue-400" />
                    <input type="number" value={newSizePrice} onChange={(e) => setNewSizePrice(e.target.value)} placeholder="Price" className="glass-card rounded-lg px-2 py-1.5 text-sm text-blue-950 border-white/40 focus:outline-none focus:ring-1 focus:ring-blue-400" />
                    <div className="flex gap-1">
                      <input type="number" value={newSizeStock} onChange={(e) => setNewSizeStock(e.target.value)} placeholder="Stock" className="flex-1 glass-card rounded-lg px-2 py-1.5 text-sm text-blue-950 border-white/40 focus:outline-none focus:ring-1 focus:ring-blue-400" />
                      <button type="button" onClick={addSize} className="bg-blue-600 text-white rounded-lg px-2 py-1.5 text-sm hover:bg-blue-700">+</button>
                    </div>
                  </div>
                </div>

                <div className="glass-panel rounded-xl p-4 border-white/30">
                  <h3 className="font-medium text-blue-950 mb-3 text-sm uppercase tracking-wider">Additional Images</h3>
                  {form.images.length > 0 && (
                    <div className="flex gap-2 flex-wrap mb-3">
                      {form.images.map((img, i) => (
                        <div key={i} className="relative w-16 h-16">
                          <img src={img} alt={`Image ${i + 1}`} className="w-full h-full object-contain bg-white/30 rounded-lg" />
                          <button type="button"
                            onClick={() => setForm((prev) => ({ ...prev, images: prev.images.filter((_, j) => j !== i) }))}
                            className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center">
                            <X className="w-2.5 h-2.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <label className={`flex items-center gap-2 px-4 py-2 glass-card rounded-lg text-sm cursor-pointer w-fit transition-colors ${uploadingExtra ? "opacity-60 pointer-events-none" : "text-blue-900 hover:bg-white/40"}`}>
                    <Upload className="w-4 h-4" />
                    {uploadingExtra ? "Uploading..." : "Upload Images"}
                    <input type="file" accept="image/*" multiple className="hidden" onChange={handleExtraImages} disabled={uploadingExtra} />
                  </label>
                  <p className="text-xs text-blue-800/50 mt-1">You can select multiple images at once</p>
                </div>
              </>
            )}

            <DialogFooter className="mt-6 border-t border-white/20 pt-4">
              <Button type="button" variant="outline" onClick={() => setIsFormOpen(false)} className="glass-card hover:bg-white/40 text-blue-900 border-white/40">Cancel</Button>
              <Button type="submit" disabled={createProduct.isPending || updateProduct.isPending} className="bg-blue-600 hover:bg-blue-700 text-white ml-2">
                {editingProduct ? "Save Changes" : "Create Product"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
