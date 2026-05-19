import { useEffect, useState, useRef } from "react";
  import { AdminLayout } from "@/components/admin-layout";
  import { useListProducts } from "@workspace/api-client-react";
  import { Button } from "@/components/ui/button";
  import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
  import { Plus, Edit2, Trash2, Package, Upload, X, CheckSquare, Square } from "lucide-react";
  import { toast } from "sonner";
  import { apiFetch } from "@/lib/api";

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

  type Bundle = { id: string; name: string; description: string; productIds: string[]; price: number; imageUrl: string | null; active: boolean; createdAt: string };
  const empty = { name: "", description: "", productIds: [] as string[], price: 0, imageUrl: "", active: true };

  export default function AdminBundles() {
    const [bundles, setBundles] = useState<Bundle[]>([]);
    const [loading, setLoading] = useState(true);
    const [open, setOpen] = useState(false);
    const [editing, setEditing] = useState<Bundle | null>(null);
    const [form, setForm] = useState(empty);
    const [saving, setSaving] = useState(false);
    const [uploadingImage, setUploadingImage] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { data: products } = useListProducts();

    const load = () => {
      apiFetch("/api/admin/bundles").then((r) => r.json()).then(setBundles).catch(() => {}).finally(() => setLoading(false));
    };
    useEffect(() => { load(); }, []);

    const openCreate = () => { setEditing(null); setForm(empty); setOpen(true); };
    const openEdit = (b: Bundle) => { setEditing(b); setForm({ name: b.name, description: b.description, productIds: b.productIds, price: b.price, imageUrl: b.imageUrl ?? "", active: b.active }); setOpen(true); };

    const toggleProduct = (id: string) => {
      setForm((prev) => ({ ...prev, productIds: prev.productIds.includes(id) ? prev.productIds.filter((x) => x !== id) : [...prev.productIds, id] }));
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (!file.type.startsWith("image/")) { toast.error("Please select an image file"); return; }
      setUploadingImage(true);
      try {
        const url = await uploadToCloudinary(file);
        if (!url) throw new Error("Upload failed");
        setForm((prev) => ({ ...prev, imageUrl: url }));
        toast.success("Image uploaded");
      } catch { toast.error("Upload failed"); } finally {
        setUploadingImage(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    };

    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setSaving(true);
      const payload = { ...form, imageUrl: form.imageUrl || null };
      try {
        if (editing) {
          await apiFetch(`/api/admin/bundles/${editing.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
          toast.success("Bundle updated");
        } else {
          await apiFetch("/api/admin/bundles", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
          toast.success("Bundle created");
        }
        setOpen(false); load();
      } catch { toast.error("Failed to save bundle"); } finally { setSaving(false); }
    };

    const handleDelete = async (id: string) => {
      if (!confirm("Delete this bundle?")) return;
      await apiFetch(`/api/admin/bundles/${id}`, { method: "DELETE" });
      toast.success("Bundle deleted"); load();
    };

    const toggleActive = async (b: Bundle) => {
      await apiFetch(`/api/admin/bundles/${b.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ active: !b.active }) });
      load();
    };

    return (
      <AdminLayout>
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-serif text-blue-950 mb-2">Bundles & Gift Sets</h1>
            <p className="text-blue-900/70">Curate product bundles at special prices</p>
          </div>
          <Button onClick={openCreate} className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl"><Plus className="w-4 h-4 mr-2" /> New Bundle</Button>
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-48"><div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-600" /></div>
        ) : bundles.length === 0 ? (
          <div className="glass-panel rounded-3xl p-12 text-center"><Package className="w-12 h-12 text-blue-200 mx-auto mb-4" /><p className="text-blue-800/60">No bundles yet. Create your first one.</p></div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {bundles.map((b) => (
              <div key={b.id} className="glass-panel rounded-3xl overflow-hidden flex flex-col shadow-md">
                {/* Bundle image banner */}
                <div className="relative h-48 bg-gradient-to-br from-blue-100 to-indigo-200 flex items-center justify-center overflow-hidden">
                  {b.imageUrl ? (
                    <img src={b.imageUrl} alt={b.name} className="w-full h-full object-cover" />
                  ) : (
                    <Package className="w-16 h-16 text-blue-300" />
                  )}
                  <div className="absolute top-3 right-3 flex gap-1">
                    <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${b.active ? "bg-green-500 text-white" : "bg-gray-400 text-white"}`}>{b.active ? "Active" : "Inactive"}</span>
                  </div>
                </div>
                <div className="p-5 flex flex-col gap-3 flex-1">
                  <div>
                    <h3 className="font-serif text-xl text-blue-950 mb-1">{b.name}</h3>
                    <p className="text-sm text-blue-800/60">{b.description}</p>
                  </div>
                  <div className="flex items-center justify-between mt-auto">
                    <div>
                      <p className="text-2xl font-bold text-blue-900">${b.price.toFixed(2)}</p>
                      <p className="text-xs text-blue-800/50">{b.productIds.length} item{b.productIds.length !== 1 ? "s" : ""}</p>
                    </div>
                    <div className="flex gap-2 items-center">
                      <button onClick={() => toggleActive(b)} className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${b.active ? "bg-amber-100 text-amber-700 hover:bg-amber-200" : "bg-green-100 text-green-700 hover:bg-green-200"}`}>
                        {b.active ? "Deactivate" : "Activate"}
                      </button>
                      <button onClick={() => openEdit(b)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"><Edit2 className="w-4 h-4" /></button>
                      <button onClick={() => handleDelete(b.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="glass-panel-heavy border-white/50 max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle className="text-2xl font-serif text-blue-950">{editing ? "Edit Bundle" : "New Bundle"}</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-blue-900/80 mb-1">Bundle Name</label>
                  <input required type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full glass-card rounded-lg px-3 py-2 text-blue-950 border-white/40 focus:ring-2 focus:ring-blue-400 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-blue-900/80 mb-1">Bundle Price ($)</label>
                  <input required type="number" min="0" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })} className="w-full glass-card rounded-lg px-3 py-2 text-blue-950 border-white/40 focus:ring-2 focus:ring-blue-400 focus:outline-none" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-blue-900/80 mb-1">Description</label>
                <textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full glass-card rounded-lg px-3 py-2 text-blue-950 border-white/40 focus:ring-2 focus:ring-blue-400 focus:outline-none resize-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-blue-900/80 mb-2">Bundle Image</label>
                <div className="flex items-center gap-3 flex-wrap">
                  {form.imageUrl && (
                    <div className="relative">
                      <img src={form.imageUrl} alt="Preview" className="w-16 h-16 object-cover rounded-lg border border-white/40" />
                      <button type="button" onClick={() => setForm({ ...form, imageUrl: "" })} className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 text-xs"><X className="w-3 h-3" /></button>
                    </div>
                  )}
                  <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" id="bundle-image-input" />
                  <label htmlFor="bundle-image-input" className={`flex items-center gap-2 px-4 py-2 glass-card rounded-lg text-sm text-blue-900 hover:bg-white/40 transition-colors cursor-pointer border border-white/40 ${uploadingImage ? "opacity-50 pointer-events-none" : ""}`}>
                    <Upload className="w-4 h-4" />
                    {uploadingImage ? "Uploading…" : form.imageUrl ? "Change Image" : "Upload Image"}
                  </label>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-blue-900/80 mb-2">Select Products ({form.productIds.length} selected)</label>
                <div className="max-h-48 overflow-y-auto space-y-1 glass-card rounded-lg p-2">
                  {products?.map((p) => (
                    <button key={p.id} type="button" onClick={() => toggleProduct(p.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${form.productIds.includes(p.id) ? "bg-blue-100/60 text-blue-900" : "hover:bg-white/30 text-blue-800"}`}>
                      {form.productIds.includes(p.id) ? <CheckSquare className="w-4 h-4 text-blue-600 flex-shrink-0" /> : <Square className="w-4 h-4 text-blue-300 flex-shrink-0" />}
                      <span className="text-sm truncate">{p.name}</span>
                      <span className="ml-auto text-xs text-blue-600/70">${p.price}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="bundle-active" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} className="w-4 h-4 rounded" />
                <label htmlFor="bundle-active" className="text-sm font-medium text-blue-900">Active (visible to customers)</label>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpen(false)} className="glass-card rounded-xl">Cancel</Button>
                <Button type="submit" disabled={saving} className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl">{saving ? "Saving…" : editing ? "Update" : "Create Bundle"}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </AdminLayout>
    );
  }