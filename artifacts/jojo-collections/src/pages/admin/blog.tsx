import { useEffect, useState, useRef } from "react";
  import { AdminLayout } from "@/components/admin-layout";
  import { Button } from "@/components/ui/button";
  import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
  import { Plus, Edit2, Trash2, BookOpen, Eye, EyeOff, Upload, Archive, X } from "lucide-react";
  import { toast } from "sonner";
  import { apiFetch } from "@/lib/api";

  type Post = { id: string; title: string; summary: string; content: string; imageUrl: string | null; author: string; published: boolean; storedInFolder: string | null; createdAt: string };
  type StorageFolder = { id: string; name: string; isSystem: boolean };
  const empty = { title: "", summary: "", content: "", imageUrl: "", author: "Jojo Collections", published: false };

  export default function AdminBlog() {
    const [posts, setPosts] = useState<Post[]>([]);
    const [loading, setLoading] = useState(true);
    const [open, setOpen] = useState(false);
    const [editing, setEditing] = useState<Post | null>(null);
    const [form, setForm] = useState(empty);
    const [saving, setSaving] = useState(false);
    const [archiveOpen, setArchiveOpen] = useState(false);
    const [archivingPost, setArchivingPost] = useState<Post | null>(null);
    const [folders, setFolders] = useState<StorageFolder[]>([]);
    const [selectedFolder, setSelectedFolder] = useState("");
    const [archiving, setArchiving] = useState(false);
    const [uploadingImage, setUploadingImage] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const load = () => {
      apiFetch("/api/admin/blog").then((r) => r.json()).then(setPosts).catch(() => {}).finally(() => setLoading(false));
    };
    useEffect(() => { load(); }, []);

    const openCreate = () => { setEditing(null); setForm(empty); setOpen(true); };
    const openEdit = (p: Post) => { setEditing(p); setForm({ title: p.title, summary: p.summary, content: p.content, imageUrl: p.imageUrl ?? "", author: p.author, published: p.published }); setOpen(true); };

    const openArchive = async (p: Post) => {
      setArchivingPost(p);
      try {
        const res = await apiFetch("/api/admin/storage/folders");
        const data: StorageFolder[] = await res.json();
        setFolders(data); // show ALL folders including system ones
        setSelectedFolder(data[0]?.id ?? "");
      } catch { toast.error("Failed to load folders"); }
      setArchiveOpen(true);
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (!file.type.startsWith("image/")) { toast.error("Please select an image file"); return; }
      setUploadingImage(true);
      try {
        const res = await apiFetch("/api/storage/uploads/request-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type }),
        });
        const data = await res.json();
        await fetch(data.uploadURL, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
        const objectPath = data.objectPath ?? `/objects/uploads/${file.name}`;
        setForm((prev) => ({ ...prev, imageUrl: `/api/storage${objectPath}` }));
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
          await apiFetch(`/api/admin/blog/${editing.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
          toast.success("Post updated");
        } else {
          await apiFetch("/api/admin/blog", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
          toast.success("Post created");
        }
        setOpen(false); load();
      } catch { toast.error("Failed to save post"); } finally { setSaving(false); }
    };

    const handleTogglePublish = async (p: Post) => {
      await apiFetch(`/api/admin/blog/${p.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ published: !p.published }) });
      toast.success(p.published ? "Post unpublished" : "Post published");
      load();
    };

    const handleDelete = async (id: string) => {
      if (!confirm("Delete this post?")) return;
      await apiFetch(`/api/admin/blog/${id}`, { method: "DELETE" });
      toast.success("Post deleted"); load();
    };

    const handleArchive = async () => {
      if (!archivingPost || !selectedFolder) { toast.error("Please select a folder"); return; }
      setArchiving(true);
      try {
        const res = await apiFetch(`/api/admin/storage/blog/${archivingPost.id}/archive`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ folderId: selectedFolder }),
        });
        if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? "Failed"); }
        toast.success("Post moved to storage");
        setArchiveOpen(false); setArchivingPost(null); load();
      } catch (err) { toast.error(err instanceof Error ? err.message : "Archive failed"); } finally { setArchiving(false); }
    };

    return (
      <AdminLayout>
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-serif text-blue-950 mb-2 flex items-center gap-3"><BookOpen className="w-7 h-7 text-blue-600" /> Fragrance Journal</h1>
            <p className="text-blue-900/70">Manage blog posts and articles</p>
          </div>
          <Button onClick={openCreate} className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl"><Plus className="w-4 h-4 mr-2" /> New Post</Button>
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-48"><div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-600" /></div>
        ) : posts.length === 0 ? (
          <div className="glass-panel rounded-3xl p-12 text-center"><BookOpen className="w-12 h-12 text-blue-200 mx-auto mb-4" /><p className="text-blue-800/60">No posts yet.</p></div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {posts.map((p) => (
              <div key={p.id} className="glass-panel rounded-2xl p-5 flex gap-4 items-start">
                {p.imageUrl ? (
                  <img src={p.imageUrl} alt={p.title} className="w-20 h-20 rounded-xl object-cover flex-shrink-0" />
                ) : (
                  <div className="w-20 h-20 rounded-xl glass-card flex items-center justify-center flex-shrink-0"><BookOpen className="w-8 h-8 text-blue-300" /></div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <h3 className="font-serif text-lg text-blue-950 truncate">{p.title}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${p.published ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>{p.published ? "Published" : "Draft"}</span>
                    {p.storedInFolder && <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">Archived</span>}
                  </div>
                  <p className="text-sm text-blue-800/60 line-clamp-2 mb-1">{p.summary}</p>
                  <p className="text-xs text-blue-800/40">By {p.author} · {new Date(p.createdAt).toLocaleDateString()}</p>
                </div>
                <div className="flex gap-1 flex-shrink-0 flex-wrap justify-end">
                  <button onClick={() => handleTogglePublish(p)} className={`p-2 rounded-lg transition-colors ${p.published ? "text-amber-600 hover:bg-amber-50" : "text-green-600 hover:bg-green-50"}`} title={p.published ? "Unpublish" : "Publish"}>
                    {p.published ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                  {!p.storedInFolder && (
                    <button onClick={() => openArchive(p)} className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg" title="Move to storage"><Archive className="w-4 h-4" /></button>
                  )}
                  <button onClick={() => openEdit(p)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"><Edit2 className="w-4 h-4" /></button>
                  <button onClick={() => handleDelete(p.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Create/Edit Dialog */}
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="glass-panel-heavy border-white/50 max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle className="text-2xl font-serif text-blue-950">{editing ? "Edit Post" : "New Post"}</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 mt-4">
              <div>
                <label className="block text-sm font-medium text-blue-900/80 mb-1">Title</label>
                <input required type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="w-full glass-card rounded-lg px-3 py-2 text-blue-950 border-white/40 focus:ring-2 focus:ring-blue-400 focus:outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-blue-900/80 mb-1">Summary</label>
                <textarea rows={2} value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} className="w-full glass-card rounded-lg px-3 py-2 text-blue-950 border-white/40 focus:ring-2 focus:ring-blue-400 focus:outline-none resize-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-blue-900/80 mb-1">Content</label>
                <textarea required rows={6} value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} className="w-full glass-card rounded-lg px-3 py-2 text-blue-950 border-white/40 focus:ring-2 focus:ring-blue-400 focus:outline-none resize-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-blue-900/80 mb-1">Cover Image</label>
                <div className="flex items-center gap-3 flex-wrap">
                  {form.imageUrl && (
                    <div className="relative">
                      <img src={form.imageUrl} alt="Cover" className="w-16 h-16 object-cover rounded-lg border border-white/40" />
                      <button type="button" onClick={() => setForm({ ...form, imageUrl: "" })} className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 text-xs"><X className="w-3 h-3" /></button>
                    </div>
                  )}
                  <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" id="blog-image-input" />
                  <label htmlFor="blog-image-input" className={`flex items-center gap-2 px-4 py-2 glass-card rounded-lg text-sm text-blue-900 hover:bg-white/40 transition-colors cursor-pointer border border-white/40 ${uploadingImage ? "opacity-50 pointer-events-none" : ""}`}>
                    <Upload className="w-4 h-4" />
                    {uploadingImage ? "Uploading…" : form.imageUrl ? "Change Image" : "Upload Image"}
                  </label>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-blue-900/80 mb-1">Author</label>
                  <input type="text" value={form.author} onChange={(e) => setForm({ ...form, author: e.target.value })} className="w-full glass-card rounded-lg px-3 py-2 text-blue-950 border-white/40 focus:ring-2 focus:ring-blue-400 focus:outline-none" />
                </div>
                <div className="flex items-center gap-3 mt-5">
                  <input type="checkbox" id="published" checked={form.published} onChange={(e) => setForm({ ...form, published: e.target.checked })} className="w-4 h-4 rounded" />
                  <label htmlFor="published" className="text-sm font-medium text-blue-900">Publish immediately</label>
                </div>
              </div>
              <DialogFooter className="mt-6">
                <Button type="button" variant="outline" onClick={() => setOpen(false)} className="glass-card rounded-xl">Cancel</Button>
                <Button type="submit" disabled={saving} className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl">{saving ? "Saving…" : editing ? "Update Post" : "Create Post"}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Archive Dialog */}
        <Dialog open={archiveOpen} onOpenChange={setArchiveOpen}>
          <DialogContent className="glass-panel-heavy border-white/50 max-w-md">
            <DialogHeader><DialogTitle className="text-xl font-serif text-blue-950">Move to Storage</DialogTitle></DialogHeader>
            <div className="mt-4 space-y-4">
              <p className="text-sm text-blue-800/70">Move "<strong>{archivingPost?.title}</strong>" to a storage folder. It will be unpublished and hidden from the storefront.</p>
              {folders.length === 0 ? (
                <p className="text-sm text-amber-700 glass-card rounded-lg p-3">No storage folders found. Create one in the Storage section first.</p>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-blue-900/80 mb-1">Select Folder</label>
                  <select value={selectedFolder} onChange={(e) => setSelectedFolder(e.target.value)} className="w-full glass-card rounded-lg px-3 py-2 text-blue-950 border-white/40 focus:ring-2 focus:ring-blue-400 focus:outline-none">
                    {folders.map((f) => <option key={f.id} value={f.id}>{f.name}{f.isSystem ? " (System)" : ""}</option>)}
                  </select>
                </div>
              )}
            </div>
            <DialogFooter className="mt-6">
              <Button variant="outline" onClick={() => setArchiveOpen(false)} className="glass-card rounded-xl">Cancel</Button>
              <Button onClick={handleArchive} disabled={archiving || folders.length === 0} className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl">{archiving ? "Moving…" : "Move to Storage"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </AdminLayout>
    );
  }