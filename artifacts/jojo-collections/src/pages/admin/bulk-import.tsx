import { useState, useRef } from "react";
import { AdminLayout } from "@/components/admin-layout";
import { Button } from "@/components/ui/button";
import { Upload, Download, CheckCircle, AlertCircle, FileText } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";

type CSVRow = Record<string, string>;

function parseCSV(text: string): CSVRow[] {
  const lines = text.trim().split("\n");
  if (lines.length < 2) return [];
  const headers = lines[0]!.split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
  return lines.slice(1).map((line) => {
    const values = line.split(",").map((v) => v.trim().replace(/^"|"$/g, ""));
    return Object.fromEntries(headers.map((h, i) => [h, values[i] ?? ""]));
  });
}

const TEMPLATE_CSV = `name,brand,description,category,price,sizeMl,stock,featured,notes,topNotes,heartNotes,baseNotes,imageUrl,collection
Rose Elixir,Maison Bloom,A rich floral scent,Eau de Parfum,89.99,50,25,true,"Rose, Oud, Musk",Bergamot,Rose,Musk,,Summer Collection
Ocean Breeze,Aqua Line,Fresh and clean scent,Eau de Toilette,54.99,100,40,false,"Sea Salt, Lime, Cedar",Lime,Sea Salt,Cedar,,`;

export default function BulkImport() {
  const [rows, setRows] = useState<CSVRow[]>([]);
  const [filename, setFilename] = useState("");
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ imported: number } | null>(null);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFilename(file.name);
    setResult(null);
    setError("");
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = parseCSV(ev.target?.result as string);
        setRows(parsed);
      } catch {
        setError("Could not parse CSV file. Check the format.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleImport = async () => {
    if (rows.length === 0) return;
    setImporting(true);
    setError("");
    try {
      const res = await apiFetch("/api/admin/products/bulk-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(rows),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Import failed");
      setResult(data);
      setRows([]);
      setFilename("");
      toast.success(`${data.imported} products imported successfully`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Import failed";
      setError(msg);
      toast.error(msg);
    } finally {
      setImporting(false);
    }
  };

  const downloadTemplate = () => {
    const blob = new Blob([TEMPLATE_CSV], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "jojo-import-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AdminLayout>
      <div className="mb-8">
        <h1 className="text-3xl font-serif text-foreground mb-2">Bulk Product Import</h1>
        <p className="text-muted-foreground">Upload a CSV file to add multiple products at once</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          {/* Upload Area */}
          <div className="glass-panel-heavy rounded-3xl p-8 border-white/50">
            <div
              className="border-2 border-dashed border-blue-300/50 rounded-2xl p-12 text-center cursor-pointer hover:border-blue-400 transition-colors"
              onClick={() => inputRef.current?.click()}
            >
              <Upload className="w-10 h-10 text-blue-400 mx-auto mb-4" />
              <p className="font-medium text-foreground mb-1">{filename || "Click to upload CSV"}</p>
              <p className="text-sm text-muted-foreground">CSV files only · Max 500 rows</p>
              <input ref={inputRef} type="file" accept=".csv" className="hidden" onChange={handleFile} />
            </div>

            {rows.length > 0 && (
              <div className="mt-6">
                <div className="flex items-center gap-2 mb-4">
                  <FileText className="w-5 h-5 text-blue-600" />
                  <span className="font-medium text-foreground">{rows.length} rows ready to import</span>
                </div>
                <div className="overflow-x-auto max-h-64 rounded-xl glass-card border-white/40">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-white/20 sticky top-0">
                      <tr>{Object.keys(rows[0] ?? {}).map((h) => <th key={h} className="px-3 py-2 text-foreground font-medium whitespace-nowrap">{h}</th>)}</tr>
                    </thead>
                    <tbody className="divide-y divide-white/20">
                      {rows.slice(0, 10).map((row, i) => (
                        <tr key={i}>
                          {Object.values(row).map((v, j) => <td key={j} className="px-3 py-1.5 text-foreground/70 max-w-[120px] truncate">{v}</td>)}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {rows.length > 10 && <p className="text-center text-xs text-muted-foreground/60 py-2">... and {rows.length - 10} more rows</p>}
                </div>
                <Button onClick={handleImport} disabled={importing} className="w-full mt-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white h-11">
                  {importing ? "Importing..." : `Import ${rows.length} Products`}
                </Button>
              </div>
            )}

            {error && (
              <div className="mt-4 flex items-center gap-2 text-red-300 bg-red-400/15 rounded-xl px-4 py-3">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <span className="text-sm">{error}</span>
              </div>
            )}

            {result && (
              <div className="mt-4 flex items-center gap-2 text-green-200 bg-green-400/15 rounded-xl px-4 py-3">
                <CheckCircle className="w-5 h-5 flex-shrink-0" />
                <span className="text-sm font-medium">{result.imported} products imported successfully!</span>
              </div>
            )}
          </div>
        </div>

        {/* Template Download */}
        <div className="space-y-4">
          <div className="glass-panel-heavy rounded-2xl p-6 border-white/50">
            <h2 className="font-serif text-lg text-foreground mb-3">CSV Template</h2>
            <p className="text-sm text-muted-foreground mb-4">Download our template to make sure your data is formatted correctly.</p>
            <Button onClick={downloadTemplate} variant="outline" className="w-full glass-card text-foreground border-white/40">
              <Download className="w-4 h-4 mr-2" /> Download Template
            </Button>
          </div>

          <div className="glass-panel-heavy rounded-2xl p-6 border-white/50">
            <h2 className="font-serif text-lg text-foreground mb-3">Required Columns</h2>
            <ul className="text-sm text-foreground/70 space-y-1">
              {["name", "brand", "price"].map((f) => <li key={f} className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-red-400 flex-shrink-0" /><code className="font-mono text-xs text-foreground/90">{f}</code></li>)}
            </ul>
            <h2 className="font-serif text-lg text-foreground mt-4 mb-3">Optional Columns</h2>
            <ul className="text-sm text-foreground/70 space-y-1">
              {["description", "category", "sizeMl", "stock", "featured", "notes", "topNotes", "heartNotes", "baseNotes", "imageUrl", "collection"].map((f) => <li key={f} className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-blue-300 flex-shrink-0" /><code className="font-mono text-xs text-foreground/90">{f}</code></li>)}
            </ul>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
