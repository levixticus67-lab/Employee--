import { useState, useEffect, useCallback } from "react";
import { AdminLayout } from "@/components/admin-layout";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { FolderOpen, Folder, Plus, Trash2, RotateCcw, Search, Archive, ShoppingCart, BookOpen } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";

type StorageFolder = { id: string; name: string; description: string; isSystem: boolean; createdAt: string };
type StorageItem = {
  id: string; folderId: string; type: "order_log" | "blog_post";
  referenceId: string; title: string; snapshot: Record<string, unknown>; archivedAt: string;
};

export default function AdminStorage() {
  const [folders, setFolders] = useState<StorageFolder[]>([]);
  const [items, setItems] = useState<StorageItem[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "order_log" | "blog_post">("all");
  const [loadingFolders, setLoadingFolders] = useState(true);
  const [loadingItems, setLoadingItems] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [creating, setCreating] = useState(false);

  const loadFolders = useCallback(async () => {
    setLoadingFolders(true);
    try {
      const res = await apiFetch("/api/admin/storage/folders");
      const data: StorageFolder[] = await res.json();
      setFolders(data);
      if (data.length > 0 && !selectedFolder) setSelectedFolder(data[0]!.id);
    } catch { toast.error("Failed to load folders"); } finally { setLoadingFolders(false); }
  }, [selectedFolder]);

  const loadItems = useCallback(async () => {
    if (!selectedFolder) return;
    setLoadingItems(true);
    try {
      const params = new URLSearchParams({ folderId: selectedFolder });
      if (search) params.set("search", search);
      if (typeFilter !== "all") params.set("type", typeFilter);
      const res = await apiFetch(`/api/admin/storage/items?${params}`);
      setItems(await res.json());
    } catch { toast.error("Failed to load items"); } finally { setLoadingItems(false); }
  }, [selectedFolder, search, typeFilter]);

  useEffect(() => { loadFolders(); }, []);
  useEffect(() => { if (selectedFolder) loadItems(); }, [selectedFolder, search, typeFilter]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    try {
      await apiFetch("/api/admin/storage/folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim(), description: newDesc.trim() }),
      });
      toast.success("Folder created");
      setCreateOpen(false); setNewName(""); setNewDesc("");
      await loadFolders();
    } catch { toast.error("Failed to create folder"); } finally { setCreating(false); }
  };

  const handleDeleteFolder = async (folder: StorageFolder) => {
    if (folder.isSystem) { toast.error("System folders cannot be deleted"); return; }
    if (!confirm(`Delete folder "${folder.name}"? Items will be moved to Order Logs.`)) return;
    try {
      await apiFetch(`/api/admin/storage/folders/${folder.id}`, { method: "DELETE" });
      toast.success("Folder deleted");
      setSelectedFolder(null);
      await loadFolders();
    } catch { toast.error("Failed to delete folder"); }
  };

  const handleDeleteItem = async (item: StorageItem) => {
    const label = item.type === "order_log" ? "order permanently" : "journal article permanently";
    if (!confirm(`Delete this ${label}? This cannot be undone.`)) return;
    try {
      await apiFetch(`/api/admin/storage/items/${item.id}`, { method: "DELETE" });
      toast.success("Deleted permanently");
      await loadItems();
    } catch { toast.error("Failed to delete"); }
  };

  const handleRestore = async (item: StorageItem) => {
    if (item.type !== "blog_post") return;
    try {
      await apiFetch(`/api/admin/storage/items/${item.id}/restore`, { method: "POST" });
      toast.success("Article restored to Journal");
      await loadItems();
    } catch { toast.error("Failed to restore article"); }
  };

  const currentFolder = folders.find((f) => f.id === selectedFolder);

  return (
    <AdminLayout>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-serif text-blue-950 mb-2">Storage</h1>
          <p className="text-blue-900/70">Archive and organise your content for later use</p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl">
          <Plus className="w-4 h-4 mr-2" /> New Folder
        </Button>
      </div>

      <div className="flex gap-6 min-h-[60vh]">
        {/* Sidebar */}
        <div className="w-60 flex-shrink-0">
          <div className="glass-panel rounded-2xl border-white/50 overflow-hidden">
            <div className="px-4 py-3 border-b border-white/20">
              <p className="text-xs font-medium text-blue-900/60 uppercase tracking-wider">Folders</p>
            </div>
            {loadingFolders ? (
              <div className="p-4 text-center text-sm text-blue-800/50">Loading...</div>
            ) : folders.length === 0 ? (
              <div className="p-4 text-center text-sm text-blue-800/50">No folders yet</div>
            ) : (
              <div className="p-2 space-y-0.5">
                {folders.map((folder) => (
                  <div
                    key={folder.id}
                    onClick={() => setSelectedFolder(folder.id)}
                    className={`group flex items-center gap-2 px-3 py-2.5 rounded-xl cursor-pointer transition-all ${
                      selectedFolder === folder.id ? "bg-blue-600/20 border border-white/40" : "hover:bg-white/20"
                    }`}
                  >
                    {selectedFolder === folder.id
                      ? <FolderOpen className="w-4 h-4 text-blue-600 flex-shrink-0" />
                      : <Folder className="w-4 h-4 text-blue-400 flex-shrink-0" />}
                    <span className="text-sm font-medium text-blue-950 flex-1 truncate">{folder.name}</span>
                    {folder.isSystem
                      ? <span className="text-[9px] font-semibold text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded-full border border-blue-100 flex-shrink-0">SYS</span>
                      : <button onClick={(e) => { e.stopPropagation(); handleDeleteFolder(folder); }}
                          className="opacity-0 group-hover:opacity-100 p-0.5 text-red-400 hover:text-red-600 rounded transition-all flex-shrink-0">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                    }
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Main */}
        <div className="flex-1 min-w-0">
          {!selectedFolder ? (
            <div className="glass-panel rounded-2xl p-12 text-center border-white/50 h-full flex flex-col items-center justify-center">
              <Archive className="w-12 h-12 text-blue-200 mb-4" />
              <p className="text-blue-800/60">Select a folder to view its contents</p>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 mb-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-400" />
                  <input
                    type="text" placeholder="Search items..." value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full glass-card rounded-xl pl-10 pr-4 py-2.5 text-blue-950 border-white/40 focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />
                </div>
                <div className="flex bg-white/20 rounded-lg p-1 border border-white/30 flex-shrink-0">
                  {(["all", "order_log", "blog_post"] as const).map((t) => (
                    <button key={t} onClick={() => setTypeFilter(t)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${typeFilter === t ? "bg-white text-blue-900 shadow-sm" : "text-blue-800/70 hover:text-blue-900"}`}>
                      {t === "all" ? "All" : t === "order_log" ? "Orders" : "Journal"}
                    </button>
                  ))}
                </div>
              </div>

              <div className="glass-panel-heavy rounded-2xl border-white/50 overflow-hidden">
                {loadingItems ? (
                  <div className="p-8 text-center"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-600 mx-auto" /></div>
                ) : items.length === 0 ? (
                  <div className="p-12 text-center">
                    <Archive className="w-10 h-10 text-blue-200 mx-auto mb-3" />
                    <p className="text-blue-800/60 text-sm">
                      {currentFolder?.name === "Order Logs"
                        ? "No archived orders yet. Orders move here automatically when delivered or cancelled."
                        : "This folder is empty. Move journal articles here to archive them."}
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-white/20">
                    {items.map((item) => (
                      <div key={item.id} className="flex items-center gap-4 p-4 hover:bg-white/10 transition-colors">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${item.type === "order_log" ? "bg-blue-100 text-blue-600" : "bg-purple-100 text-purple-600"}`}>
                          {item.type === "order_log" ? <ShoppingCart className="w-5 h-5" /> : <BookOpen className="w-5 h-5" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-blue-950 text-sm truncate">{item.title}</p>
                          <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${item.type === "order_log" ? "bg-blue-50 text-blue-600" : "bg-purple-50 text-purple-600"}`}>
                              {item.type === "order_log" ? "Order Log" : "Journal Article"}
                            </span>
                            {item.type === "order_log" && item.snapshot.status && (
                              <span className="text-xs text-blue-800/50 capitalize">{String(item.snapshot.status)}</span>
                            )}
                            {item.type === "order_log" && item.snapshot.total != null && (
                              <span className="text-xs text-blue-800/50">${Number(item.snapshot.total).toFixed(2)}</span>
                            )}
                            {item.type === "order_log" && item.snapshot.buyerPhone && (
                              <span className="text-xs text-blue-600">{String(item.snapshot.buyerPhone)}</span>
                            )}
                            <span className="text-xs text-blue-800/40">{new Date(item.archivedAt).toLocaleDateString()}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {item.type === "blog_post" && (
                            <button onClick={() => handleRestore(item)}
                              className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 px-3 py-1.5 glass-card rounded-lg hover:bg-blue-50/50 transition-all">
                              <RotateCcw className="w-3.5 h-3.5" /> Restore
                            </button>
                          )}
                          <button onClick={() => handleDeleteItem(item)}
                            className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50/50 rounded-lg transition-all">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="glass-panel-heavy border-white/50 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-serif text-blue-950">Create New Folder</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4 mt-2">
            <div>
              <label className="block text-sm font-medium text-blue-900/80 mb-1">Folder Name</label>
              <input required type="text" value={newName} onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Seasonal Content"
                className="w-full glass-card rounded-xl px-4 py-2.5 text-blue-950 border-white/40 focus:outline-none focus:ring-2 focus:ring-blue-400" />
            </div>
            <div>
              <label className="block text-sm font-medium text-blue-900/80 mb-1">Description <span className="text-blue-800/40 font-normal">(optional)</span></label>
              <input type="text" value={newDesc} onChange={(e) => setNewDesc(e.target.value)}
                placeholder="What's this folder for?"
                className="w-full glass-card rounded-xl px-4 py-2.5 text-blue-950 border-white/40 focus:outline-none focus:ring-2 focus:ring-blue-400" />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)} className="glass-card text-blue-900 border-white/40">Cancel</Button>
              <Button type="submit" disabled={creating} className="bg-blue-600 hover:bg-blue-700 text-white ml-2">{creating ? "Creating..." : "Create Folder"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
