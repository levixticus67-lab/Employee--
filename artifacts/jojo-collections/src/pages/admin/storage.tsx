import { useState, useEffect, useCallback } from "react";
  import { AdminLayout } from "@/components/admin-layout";
  import { Button } from "@/components/ui/button";
  import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
  import { FolderOpen, Folder, Plus, Trash2, RotateCcw, Archive, ShoppingCart, BookOpen, Calendar } from "lucide-react";
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
    const [dateFilter, setDateFilter] = useState("");
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
        const res = await apiFetch(`/api/admin/storage/items?${params}`);
        setItems(await res.json());
      } catch { toast.error("Failed to load items"); } finally { setLoadingItems(false); }
    }, [selectedFolder, search]);

    useEffect(() => { loadFolders(); }, []);
    useEffect(() => { if (selectedFolder) loadItems(); }, [selectedFolder, search]);

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
        setCreateOpen(false); setNewName(""); setNewDesc(""); loadFolders();
      } catch { toast.error("Failed to create folder"); } finally { setCreating(false); }
    };

    const handleDeleteFolder = async (folder: StorageFolder) => {
      if (!confirm(`Delete folder "${folder.name}"? All items inside will be removed.`)) return;
      try {
        const res = await apiFetch(`/api/admin/storage/folders/${folder.id}`, { method: "DELETE" });
        if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? "Failed"); }
        toast.success("Folder deleted");
        setSelectedFolder(null); loadFolders();
      } catch (err) { toast.error(err instanceof Error ? err.message : "Delete failed"); }
    };

    const handleRestore = async (item: StorageItem) => {
      try {
        const res = await apiFetch(`/api/admin/storage/items/${item.id}/restore`, { method: "POST" });
        if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? "Failed"); }
        toast.success("Item restored");
        loadItems();
      } catch (err) { toast.error(err instanceof Error ? err.message : "Restore failed"); }
    };

    const handleDeleteItem = async (id: string) => {
      if (!confirm("Remove this item from storage?")) return;
      try {
        const res = await apiFetch(`/api/admin/storage/items/${id}`, { method: "DELETE" });
        if (!res.ok) throw new Error("Failed");
        toast.success("Item removed"); loadItems();
      } catch { toast.error("Failed to remove item"); }
    };

    // Filter items by date input
    const filteredItems = items.filter((item) => {
      const matchSearch = !search || item.title.toLowerCase().includes(search.toLowerCase());
      const matchDate = !dateFilter || item.archivedAt.slice(0, 10) === dateFilter;
      return matchSearch && matchDate;
    });

    const currentFolder = folders.find((f) => f.id === selectedFolder);

    return (
      <AdminLayout>
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-serif text-blue-950 mb-2 flex items-center gap-3"><Archive className="w-7 h-7 text-blue-600" /> Storage</h1>
            <p className="text-blue-900/70">Archived orders and journal posts</p>
          </div>
          <Button onClick={() => setCreateOpen(true)} className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl"><Plus className="w-4 h-4 mr-2" /> New Folder</Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar: folders */}
          <div className="lg:col-span-1 space-y-2">
            {loadingFolders ? (
              <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-blue-600" /></div>
            ) : folders.length === 0 ? (
              <div className="glass-panel rounded-2xl p-6 text-center">
                <Folder className="w-8 h-8 text-blue-200 mx-auto mb-2" />
                <p className="text-sm text-blue-800/60">No folders yet</p>
              </div>
            ) : (
              folders.map((folder) => (
                <div key={folder.id}
                  className={`glass-panel rounded-2xl p-4 cursor-pointer transition-all ${selectedFolder === folder.id ? "ring-2 ring-blue-400 bg-blue-50/20" : "hover:bg-white/20"}`}
                  onClick={() => setSelectedFolder(folder.id)}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      {selectedFolder === folder.id ? <FolderOpen className="w-4 h-4 text-blue-600 flex-shrink-0" /> : <Folder className="w-4 h-4 text-blue-400 flex-shrink-0" />}
                      <span className="text-sm font-medium text-blue-950 truncate">{folder.name}</span>
                    </div>
                    {!folder.isSystem && (
                      <button onClick={(e) => { e.stopPropagation(); handleDeleteFolder(folder); }} className="p-1 text-red-400 hover:text-red-600 flex-shrink-0">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  {folder.description && <p className="text-xs text-blue-800/50 mt-1 truncate">{folder.description}</p>}
                  {folder.isSystem && <span className="text-[10px] text-blue-500/70 uppercase tracking-wide">System</span>}
                </div>
              ))
            )}
          </div>

          {/* Main: items */}
          <div className="lg:col-span-3">
            {selectedFolder ? (
              <>
                {/* Filters */}
                <div className="glass-panel rounded-2xl p-4 mb-4 flex flex-col sm:flex-row gap-3">
                  <input
                    type="text"
                    placeholder="Search items…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="flex-1 glass-card rounded-lg px-3 py-2 text-sm text-blue-950 border-white/40 focus:ring-2 focus:ring-blue-400 focus:outline-none"
                  />
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-blue-500 flex-shrink-0" />
                    <input
                      type="date"
                      value={dateFilter}
                      onChange={(e) => setDateFilter(e.target.value)}
                      className="glass-card rounded-lg px-3 py-2 text-sm text-blue-950 border-white/40 focus:ring-2 focus:ring-blue-400 focus:outline-none"
                    />
                    {dateFilter && (
                      <button onClick={() => setDateFilter("")} className="text-xs text-blue-500 hover:text-blue-700 underline whitespace-nowrap">Clear</button>
                    )}
                  </div>
                </div>

                {loadingItems ? (
                  <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-600" /></div>
                ) : filteredItems.length === 0 ? (
                  <div className="glass-panel rounded-3xl p-12 text-center">
                    <Archive className="w-10 h-10 text-blue-200 mx-auto mb-3" />
                    <p className="text-blue-800/60">{dateFilter ? `No items archived on ${dateFilter}` : "No items in this folder"}</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredItems.map((item) => (
                      <div key={item.id} className="glass-panel rounded-2xl p-4 flex items-start gap-4">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${item.type === "order_log" ? "bg-green-100" : "bg-blue-100"}`}>
                          {item.type === "order_log" ? <ShoppingCart className="w-5 h-5 text-green-600" /> : <BookOpen className="w-5 h-5 text-blue-600" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-blue-950 truncate">{item.title}</p>
                          <div className="flex items-center gap-3 mt-1 flex-wrap">
                            <span className={`text-xs px-2 py-0.5 rounded-full ${item.type === "order_log" ? "bg-green-50 text-green-700" : "bg-blue-50 text-blue-700"}`}>
                              {item.type === "order_log" ? "Order" : "Journal"}
                            </span>
                            <span className="text-xs text-blue-800/50">{new Date(item.archivedAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</span>
                            {item.type === "order_log" && item.snapshot && (
                              <span className="text-xs text-blue-800/50">
                                {String(item.snapshot["customerName"] ?? "")} · ${Number(item.snapshot["total"] ?? 0).toFixed(2)}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-1 flex-shrink-0">
                          {item.type === "blog_post" && (
                            <button onClick={() => handleRestore(item)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg" title="Restore">
                              <RotateCcw className="w-4 h-4" />
                            </button>
                          )}
                          <button onClick={() => handleDeleteItem(item.id)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg" title="Remove">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="glass-panel rounded-3xl p-12 text-center">
                <FolderOpen className="w-12 h-12 text-blue-200 mx-auto mb-4" />
                <p className="text-blue-800/60">Select a folder to view its contents</p>
              </div>
            )}
          </div>
        </div>

        {/* Create folder dialog */}
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent className="glass-panel-heavy border-white/50 max-w-md">
            <DialogHeader><DialogTitle className="text-xl font-serif text-blue-950">New Storage Folder</DialogTitle></DialogHeader>
            <form onSubmit={handleCreate} className="mt-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-blue-900/80 mb-1">Folder Name</label>
                <input required type="text" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. 2024 Orders" className="w-full glass-card rounded-lg px-3 py-2 text-blue-950 border-white/40 focus:ring-2 focus:ring-blue-400 focus:outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-blue-900/80 mb-1">Description (optional)</label>
                <input type="text" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} className="w-full glass-card rounded-lg px-3 py-2 text-blue-950 border-white/40 focus:ring-2 focus:ring-blue-400 focus:outline-none" />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setCreateOpen(false)} className="glass-card rounded-xl">Cancel</Button>
                <Button type="submit" disabled={creating} className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl">{creating ? "Creating…" : "Create Folder"}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </AdminLayout>
    );
  }