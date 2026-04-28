import { useState } from "react";
import { AdminLayout } from "@/components/admin-layout";
import { useListProducts, useCreateProduct, useUpdateProduct, useDeleteProduct, Product } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Plus, Edit2, Trash2, X, Upload } from "lucide-react";
import { toast } from "sonner";
import { ObjectUploader } from "@workspace/object-storage-web";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

const CATEGORIES = ["Eau de Parfum", "Eau de Toilette", "Body Mist"];

export default function AdminProducts() {
  const { data: products, refetch, isLoading } = useListProducts();
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const deleteProduct = useDeleteProduct();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  const initialFormState = {
    name: "",
    brand: "",
    description: "",
    category: CATEGORIES[0],
    price: 0,
    sizeMl: 100,
    stock: 10,
    featured: false,
    imageUrl: "",
    notes: [] as string[],
    topNotes: "",
    heartNotes: "",
    baseNotes: "",
  };

  const [form, setForm] = useState(initialFormState);
  const [notesInput, setNotesInput] = useState("");

  const handleOpenCreate = () => {
    setEditingProduct(null);
    setForm(initialFormState);
    setNotesInput("");
    setIsFormOpen(true);
  };

  const handleOpenEdit = (product: Product) => {
    setEditingProduct(product);
    setForm({
      name: product.name,
      brand: product.brand,
      description: product.description,
      category: product.category,
      price: product.price,
      sizeMl: product.sizeMl || 0,
      stock: product.stock,
      featured: product.featured,
      imageUrl: product.imageUrl || "",
      notes: product.notes || [],
      topNotes: product.topNotes || "",
      heartNotes: product.heartNotes || "",
      baseNotes: product.baseNotes || "",
    });
    setNotesInput(product.notes?.join(", ") || "");
    setIsFormOpen(true);
  };

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this product?")) {
      deleteProduct.mutate({ id }, {
        onSuccess: () => {
          toast.success("Product deleted");
          refetch();
        },
        onError: () => toast.error("Failed to delete product")
      });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      ...form,
      notes: notesInput.split(",").map(n => n.trim()).filter(Boolean),
    };

    if (editingProduct) {
      updateProduct.mutate({ id: editingProduct.id, data: payload }, {
        onSuccess: () => {
          toast.success("Product updated");
          setIsFormOpen(false);
          refetch();
        },
        onError: () => toast.error("Failed to update product")
      });
    } else {
      createProduct.mutate({ data: payload as any }, {
        onSuccess: () => {
          toast.success("Product created");
          setIsFormOpen(false);
          refetch();
        },
        onError: () => toast.error("Failed to create product")
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
                <th className="px-6 py-4 text-sm font-medium text-blue-950">Product</th>
                <th className="px-6 py-4 text-sm font-medium text-blue-950">Category</th>
                <th className="px-6 py-4 text-sm font-medium text-blue-950">Price</th>
                <th className="px-6 py-4 text-sm font-medium text-blue-950">Stock</th>
                <th className="px-6 py-4 text-sm font-medium text-blue-950">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/20">
              {isLoading ? (
                <tr><td colSpan={5} className="px-6 py-8 text-center text-blue-800">Loading...</td></tr>
              ) : products?.length === 0 ? (
                <tr><td colSpan={5} className="px-6 py-8 text-center text-blue-800">No products found.</td></tr>
              ) : (
                products?.map(product => (
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
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-blue-900">{product.category}</td>
                    <td className="px-6 py-4 text-sm font-medium text-blue-950">${product.price.toFixed(2)}</td>
                    <td className="px-6 py-4">
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        product.stock > 10 ? 'bg-green-100 text-green-800' :
                        product.stock > 0 ? 'bg-orange-100 text-orange-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {product.stock} in stock
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2">
                        <button onClick={() => handleOpenEdit(product)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDelete(product.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
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
        <DialogContent className="max-w-2xl glass-panel-heavy border-white/50 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-serif text-blue-950">
              {editingProduct ? "Edit Product" : "New Product"}
            </DialogTitle>
          </DialogHeader>
          
          <form onSubmit={handleSubmit} className="space-y-6 mt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-blue-900/80 mb-1">Name</label>
                  <input required type="text" value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="w-full glass-card rounded-lg px-3 py-2 text-blue-950 border-white/40 focus:ring-2 focus:ring-blue-400 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-blue-900/80 mb-1">Brand</label>
                  <input required type="text" value={form.brand} onChange={e => setForm({...form, brand: e.target.value})} className="w-full glass-card rounded-lg px-3 py-2 text-blue-950 border-white/40 focus:ring-2 focus:ring-blue-400 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-blue-900/80 mb-1">Category</label>
                  <select value={form.category} onChange={e => setForm({...form, category: e.target.value})} className="w-full glass-card rounded-lg px-3 py-2 text-blue-950 border-white/40 focus:ring-2 focus:ring-blue-400 focus:outline-none appearance-none">
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-blue-900/80 mb-1">Price ($)</label>
                    <input required type="number" min="0" step="0.01" value={form.price} onChange={e => setForm({...form, price: Number(e.target.value)})} className="w-full glass-card rounded-lg px-3 py-2 text-blue-950 border-white/40 focus:ring-2 focus:ring-blue-400 focus:outline-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-blue-900/80 mb-1">Size (ml)</label>
                    <input type="number" min="0" value={form.sizeMl} onChange={e => setForm({...form, sizeMl: Number(e.target.value)})} className="w-full glass-card rounded-lg px-3 py-2 text-blue-950 border-white/40 focus:ring-2 focus:ring-blue-400 focus:outline-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-blue-900/80 mb-1">Stock</label>
                    <input required type="number" min="0" value={form.stock} onChange={e => setForm({...form, stock: Number(e.target.value)})} className="w-full glass-card rounded-lg px-3 py-2 text-blue-950 border-white/40 focus:ring-2 focus:ring-blue-400 focus:outline-none" />
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="featured" checked={form.featured} onChange={e => setForm({...form, featured: e.target.checked})} className="w-4 h-4 text-blue-600 rounded border-white/40" />
                  <label htmlFor="featured" className="text-sm font-medium text-blue-900/80">Feature on homepage</label>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-blue-900/80 mb-1">Image</label>
                  <div className="flex gap-4 items-center">
                    {form.imageUrl && (
                      <div className="w-16 h-16 glass-card rounded p-1 flex-shrink-0 bg-white/40">
                        <img src={form.imageUrl} alt="Preview" className="w-full h-full object-contain" />
                      </div>
                    )}
                    <ObjectUploader
                      onGetUploadParameters={async (file) => {
                        const res = await fetch("/api/storage/uploads/request-url", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type }),
                        });
                        const data = await res.json();
                        return { method: "PUT", url: data.uploadURL, headers: { "Content-Type": file.type } };
                      }}
                      onComplete={(result) => {
                        if (result.successful && result.successful[0]) {
                          const file = result.successful[0];
                          const objectPath = file.response?.body?.objectPath || `/objects/uploads/${file.name}`;
                          setForm({ ...form, imageUrl: `/api/storage${objectPath}` });
                          toast.success("Image uploaded");
                        }
                      }}
                      buttonClassName="flex items-center gap-2 px-4 py-2 glass-card rounded-lg text-sm text-blue-900 hover:bg-white/40 transition-colors"
                    >
                      <Upload className="w-4 h-4" /> {form.imageUrl ? "Change Image" : "Upload Image"}
                    </ObjectUploader>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-blue-900/80 mb-1">Description</label>
                  <textarea rows={3} value={form.description} onChange={e => setForm({...form, description: e.target.value})} className="w-full glass-card rounded-lg px-3 py-2 text-blue-950 border-white/40 focus:ring-2 focus:ring-blue-400 focus:outline-none resize-none" />
                </div>
              </div>
            </div>

            <div className="border-t border-white/30 pt-4 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-blue-900/80 mb-1">Top Notes</label>
                <input type="text" value={form.topNotes} onChange={e => setForm({...form, topNotes: e.target.value})} className="w-full glass-card rounded-lg px-3 py-2 text-blue-950 border-white/40 focus:ring-2 focus:ring-blue-400 focus:outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-blue-900/80 mb-1">Heart Notes</label>
                <input type="text" value={form.heartNotes} onChange={e => setForm({...form, heartNotes: e.target.value})} className="w-full glass-card rounded-lg px-3 py-2 text-blue-950 border-white/40 focus:ring-2 focus:ring-blue-400 focus:outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-blue-900/80 mb-1">Base Notes</label>
                <input type="text" value={form.baseNotes} onChange={e => setForm({...form, baseNotes: e.target.value})} className="w-full glass-card rounded-lg px-3 py-2 text-blue-950 border-white/40 focus:ring-2 focus:ring-blue-400 focus:outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-blue-900/80 mb-1">All Notes (comma separated)</label>
                <input type="text" value={notesInput} onChange={e => setNotesInput(e.target.value)} placeholder="e.g. Vanilla, Rose, Musk" className="w-full glass-card rounded-lg px-3 py-2 text-blue-950 border-white/40 focus:ring-2 focus:ring-blue-400 focus:outline-none" />
              </div>
            </div>

            <DialogFooter className="mt-6 border-t border-white/20 pt-4">
              <Button type="button" variant="outline" onClick={() => setIsFormOpen(false)} className="glass-card hover:bg-white/40 text-blue-900 border-white/40">
                Cancel
              </Button>
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
