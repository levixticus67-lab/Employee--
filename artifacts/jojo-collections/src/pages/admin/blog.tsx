import { useEffect, useState } from "react";
import { AdminLayout } from "@/components/admin-layout";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Edit2, Trash2, BookOpen, Eye, EyeOff, Upload } from "lucide-react";
import { ObjectUploader } from "@workspace/object-storage-web";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";

type Post = { id: string; title: string; summary: string; content: string; imageUrl: string | null; author: string; published: boolean; createdAt: string };
const empty = { title: "", summary: "", content: "", imageUrl: "", author: "Jojo Collections", published: false };

export default function AdminBlog() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Post | null>(null);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);

  const load = () => {
    apiFetch("/api/admin/blog").then((r) => r.json()).then(setPosts).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const openCreate = () => { setEditing(null); setForm(empty); setOpen(true); };
  const openEdit = (p: Post) => { setEditing(p); setForm({ title: p.title, summary: p.summary, content: p.content, imageUrl: p.imageUrl ?? "", author: p.author, published: p.published }); setOpen(true); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const payload = { ...form, imageUrl: form.imageUrl || null };
    try {
      if (editing) {
        await apiFetch(`/api/admin/blog/${editing.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        toast.success("Post updated");
      } else {
        await apiFetch("/api/admin/blog", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        toast.success("Post created");
      }
      setOpen(false); load();
    } catch { toast.error("Failed to save post"); } finally { setSaving(false); }
  };

  const togglePublish = async (p: Post) => {
    await apiFetch(`/api/admin/blog/${p.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ published: !p.published }) });
    load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this article?")) return;
    await apiFetch(`/api/admin/blog/${id}`, { method: "DELETE" });
    toast.success("Post deleted"); load();
  };

  return (
    <AdminLayout>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-serif text-blue-950 mb-2">Fragrance Journal</h1>
          <p className="text-blue-900/70">Manage blog articles and fragrance tips</p>
        </div>
        <Button onClick={openCreate} className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl"><Plus className="w-4 h-4 mr-2" /> New Article</Button>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-48"><div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-600" /></div>
      ) : posts.length === 0 ? (
        <div className="glass-panel rounded-3xl p-12 text-center"><BookOpen className="w-12 h-12 text-blue-200 mx-auto mb-4" /><p className="text-blue-800/60">No articles yet. Write your first one.</p></div>
      ) : (
        <div className="space-y-4">
          {posts.map((p) => (
            <div key={p.id} className="glass-panel rounded-2xl p-5 flex items-start gap-4">
              <div className="w-20 h-14 rounded-lg glass-card flex-shrink-0 overflow-hidden flex items-center justify-center">
                {p.imageUrl ? <img src={p.imageUrl} alt={p.title} className="w-full h-full object-cover" /> : <BookOpen className="w-6 h-6 text-blue-400" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-serif text-lg text-blue-950 truncate">{p.title}</h3>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${p.published ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>{p.published ? "Published" : "Draft"}</span>
                </div>
                <p className="text-sm text-blue-800/60 truncate mb-1">{p.summary}</p>
                <p className="text-xs text-blue-800/40">By {p.author} · {new Date(p.createdAt).toLocaleDateString()}</p>
              </div>
              <div className="flex gap-1 flex-shrink-0">
                <button onClick={() => togglePublish(p)} title={p.published ? "Unpublish" : "Publish"} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg">{p.published ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>
                <button onClick={() => openEdit(p)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"><Edit2 className="w-4 h-4" /></button>
                <button onClick={() => handleDelete(p.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="glass-panel-heavy border-white/50 max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="text-2xl font-serif text-blue-950">{editing ? "Edit Article" : "New Article"}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 mt-4">
            <div>
              <label className="block text-sm font-medium text-blue-900/80 mb-1">Title</label>
              <input required type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="w-full glass-card rounded-lg px-3 py-2 text-blue-950 border-white/40 focus:ring-2 focus:ring-blue-400 focus:outline-none" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-blue-900/80 mb-1">Author</label>
                <input type="text" value={form.author} onChange={(e) => setForm({ ...form, author: e.target.value })} className="w-full glass-card rounded-lg px-3 py-2 text-blue-950 border-white/40 focus:ring-2 focus:ring-blue-400 focus:outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-blue-900/80 mb-1">Cover Image</label>
                <div className="flex items-center gap-2">
                  {form.imageUrl && (
                    <div className="w-10 h-10 glass-card rounded p-0.5 flex-shrink-0 bg-white/40 overflow-hidden">
                      <img src={form.imageUrl} alt="Cover" className="w-full h-full object-cover rounded" />
                    </div>
                  )}
                  <ObjectUploader
                    onGetUploadParameters={async (file) => {
                      const res = await apiFetch("/api/storage/uploads/request-url", {
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
                        toast.success("Cover image uploaded");
                      }
                    }}
                    buttonClassName="flex items-center gap-1.5 px-3 py-2 glass-card rounded-lg text-xs text-blue-900 hover:bg-white/40 transition-colors"
                  >
                    <Upload className="w-3.5 h-3.5" /> {form.imageUrl ? "Change" : "Upload"}
                  </ObjectUploader>
                  {form.imageUrl && (
                    <button type="button" onClick={() => setForm({ ...form, imageUrl: "" })} className="text-xs text-red-500 hover:text-red-700">✕</button>
                  )}
                </div>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-blue-900/80 mb-1">Summary (shown in listing)</label>
              <textarea rows={2} value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} className="w-full glass-card rounded-lg px-3 py-2 text-blue-950 border-white/40 focus:ring-2 focus:ring-blue-400 focus:outline-none resize-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-blue-900/80 mb-1">Content</label>
              <textarea required rows={10} value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} placeholder="Write your article here. Use blank lines to separate paragraphs." className="w-full glass-card rounded-lg px-3 py-2 text-blue-950 border-white/40 focus:ring-2 focus:ring-blue-400 focus:outline-none resize-none" />
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="published" checked={form.published} onChange={(e) => setForm({ ...form, published: e.target.checked })} className="w-4 h-4 text-blue-600 rounded" />
              <label htmlFor="published" className="text-sm font-medium text-blue-900/80">Publish immediately</label>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)} className="glass-card text-blue-900 border-white/40">Cancel</Button>
              <Button type="submit" disabled={saving} className="bg-blue-600 hover:bg-blue-700 text-white ml-2">{saving ? "Saving..." : editing ? "Save Changes" : "Create Article"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
