import { useEffect, useState, useRef } from "react";
import { AdminLayout } from "@/components/admin-layout";
import { Button } from "@/components/ui/button";
import { Settings, MessageCircle, DollarSign, AlertTriangle, Smartphone, Info, Truck, ImageIcon, Upload, X, Megaphone, Video, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";

type BannerMediaType = "none" | "image" | "video";

type SettingsData = {
  whatsappNumber: string;
  whatsappMessage: string;
  currencyDefault: string;
  lowStockThreshold: number;
  mtnNumber: string;
  airtelNumber: string;
  freeDeliveryThreshold: number;
  locationDeliveryThreshold: number;
  logoUrl: string;
  bannerEnabled: boolean;
  bannerText: string;
  bannerBgColor: string;
  bannerMediaUrl: string;
  bannerMediaType: BannerMediaType;
};

const defaults: SettingsData = {
  whatsappNumber: "",
  whatsappMessage: "Hi! I need help with my order.",
  currencyDefault: "USD",
  lowStockThreshold: 5,
  mtnNumber: "",
  airtelNumber: "",
  freeDeliveryThreshold: 0,
  locationDeliveryThreshold: 0,
  logoUrl: "",
  bannerEnabled: false,
  bannerText: "",
  bannerBgColor: "#1e3a8a",
  bannerMediaUrl: "",
  bannerMediaType: "none",
};

const COLOR_PRESETS = [
  { label: "Navy", value: "#1e3a8a" },
  { label: "Christmas", value: "#b91c1c" },
  { label: "Gold", value: "#92400e" },
  { label: "Forest", value: "#14532d" },
  { label: "Black", value: "#0f172a" },
  { label: "Violet", value: "#4c1d95" },
  { label: "Rose", value: "#9f1239" },
  { label: "Teal", value: "#134e4a" },
];

async function uploadToCloudinary(file: File, resourceType: "image" | "video" = "image"): Promise<string | null> {
  const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
  const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;
  if (!cloudName || !uploadPreset) { toast.error("Cloudinary not configured"); return null; }
  const data = new FormData();
  data.append("file", file);
  data.append("upload_preset", uploadPreset);
  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`, { method: "POST", body: data });
  const json = await res.json();
  return json.secure_url ?? null;
}

export default function AdminSettings() {
  const [form, setForm] = useState<SettingsData>(defaults);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingBannerMedia, setUploadingBannerMedia] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const bannerMediaInputRef = useRef<HTMLInputElement>(null);
  const [lowStockProducts, setLowStockProducts] = useState<{ id: string; name: string; brand: string; stock: number; imageUrl: string | null }[]>([]);

  useEffect(() => {
    Promise.all([
      apiFetch("/api/admin/settings")
        .then((r) => r.json())
        .then((d) => setForm({ ...defaults, ...d }))
        .catch(() => {}),
      apiFetch("/api/admin/low-stock")
        .then((r) => r.json())
        .then(setLowStockProducts)
        .catch(() => {}),
    ]).finally(() => setLoading(false));
  }, []);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("Please select an image file"); return; }
    setUploadingLogo(true);
    try {
      const url = await uploadToCloudinary(file, "image");
      if (!url) throw new Error("Upload failed");
      setForm((prev) => ({ ...prev, logoUrl: url }));
      toast.success("Logo uploaded — save settings to apply");
    } catch { toast.error("Upload failed"); } finally {
      setUploadingLogo(false);
      if (logoInputRef.current) logoInputRef.current.value = "";
    }
  };

  const handleBannerMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const isVideo = file.type.startsWith("video/");
    const isImage = file.type.startsWith("image/");
    if (!isVideo && !isImage) { toast.error("Please select an image or video file"); return; }
    setUploadingBannerMedia(true);
    try {
      const resourceType = isVideo ? "video" : "image";
      const url = await uploadToCloudinary(file, resourceType);
      if (!url) throw new Error("Upload failed");
      setForm((prev) => ({ ...prev, bannerMediaUrl: url, bannerMediaType: resourceType }));
      toast.success(`${isVideo ? "Video" : "Image"} uploaded — save settings to apply`);
    } catch { toast.error("Upload failed"); } finally {
      setUploadingBannerMedia(false);
      if (bannerMediaInputRef.current) bannerMediaInputRef.current.value = "";
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await apiFetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        toast.error("Could not save settings. Please try again.");
      } else {
        toast.success("Settings saved!");
      }
    } catch {
      toast.error("Network error — please check your connection.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex justify-center items-center min-h-[60vh]">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="mb-8">
        <h1 className="text-3xl font-serif text-blue-950 mb-2 flex items-center gap-3">
          <Settings className="w-7 h-7 text-blue-600" /> Store Settings
        </h1>
        <p className="text-blue-900/70">Branding, announcements, payments, and store configuration</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <form onSubmit={handleSave} className="space-y-6">

          {/* Store Logo */}
          <div className="glass-panel-heavy rounded-2xl p-6 border-white/50">
            <h2 className="text-lg font-serif text-blue-950 mb-4 flex items-center gap-2">
              <ImageIcon className="w-5 h-5 text-blue-600" /> Store Logo
            </h2>
            <div className="flex items-center gap-4 flex-wrap">
              {form.logoUrl ? (
                <div className="relative">
                  <img src={form.logoUrl} alt="Logo" className="w-16 h-16 rounded-full object-cover border-2 border-blue-200 shadow" />
                  <button type="button" onClick={() => setForm({ ...form, logoUrl: "" })} className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <div className="w-16 h-16 rounded-full bg-blue-100/60 flex items-center justify-center border-2 border-dashed border-blue-300">
                  <ImageIcon className="w-7 h-7 text-blue-300" />
                </div>
              )}
              <div>
                <input ref={logoInputRef} type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" id="logo-upload-input" />
                <label htmlFor="logo-upload-input" className={`flex items-center gap-2 px-4 py-2 glass-card rounded-lg text-sm text-blue-900 hover:bg-white/40 transition-colors cursor-pointer border border-white/40 ${uploadingLogo ? "opacity-50 pointer-events-none" : ""}`}>
                  <Upload className="w-4 h-4" />
                  {uploadingLogo ? "Uploading…" : form.logoUrl ? "Change Logo" : "Upload Logo"}
                </label>
                <p className="text-xs text-blue-800/50 mt-1.5">Round image shown next to the brand name in the header.</p>
              </div>
            </div>
          </div>

          {/* Announcement Banner */}
          <div className="glass-panel-heavy rounded-2xl p-6 border-white/50">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-serif text-blue-950 flex items-center gap-2">
                <Megaphone className="w-5 h-5 text-orange-500" /> Announcement Banner
              </h2>
              <button
                type="button"
                onClick={() => setForm((p) => ({ ...p, bannerEnabled: !p.bannerEnabled }))}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${form.bannerEnabled ? "bg-green-100 text-green-700 hover:bg-green-200" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}
              >
                {form.bannerEnabled ? <><Eye className="w-3.5 h-3.5" /> Live</> : <><EyeOff className="w-3.5 h-3.5" /> Hidden</>}
              </button>
            </div>

            <div className="space-y-4">
              {/* Text */}
              <div>
                <label className="block text-sm font-medium text-blue-900/80 mb-1">Banner Text</label>
                <input
                  type="text"
                  value={form.bannerText}
                  onChange={(e) => setForm({ ...form, bannerText: e.target.value })}
                  placeholder="🎄 Free shipping this Christmas — shop now!"
                  className="w-full glass-card rounded-lg px-3 py-2 text-blue-950 border-white/40 focus:ring-2 focus:ring-blue-400 focus:outline-none"
                />
              </div>

              {/* Background color */}
              <div>
                <label className="block text-sm font-medium text-blue-900/80 mb-2">Background Color</label>
                <div className="flex items-center gap-2 flex-wrap">
                  {COLOR_PRESETS.map((c) => (
                    <button
                      key={c.value}
                      type="button"
                      title={c.label}
                      onClick={() => setForm({ ...form, bannerBgColor: c.value })}
                      className={`w-7 h-7 rounded-full border-2 transition-transform hover:scale-110 ${form.bannerBgColor === c.value ? "border-blue-400 scale-110" : "border-white/60"}`}
                      style={{ background: c.value }}
                    />
                  ))}
                  <input
                    type="color"
                    value={form.bannerBgColor}
                    onChange={(e) => setForm({ ...form, bannerBgColor: e.target.value })}
                    className="w-7 h-7 rounded-full border-2 border-white/60 cursor-pointer bg-transparent"
                    title="Custom color"
                  />
                </div>
              </div>

              {/* Media upload */}
              <div>
                <label className="block text-sm font-medium text-blue-900/80 mb-2">
                  Background Media <span className="text-xs font-normal text-blue-800/50">(image or short looping video)</span>
                </label>
                <div className="flex items-start gap-3 flex-wrap">
                  {form.bannerMediaUrl && (
                    <div className="relative rounded-lg overflow-hidden border border-white/40 w-28 h-16 flex-shrink-0">
                      {form.bannerMediaType === "video" ? (
                        <video src={form.bannerMediaUrl} className="w-full h-full object-cover" muted autoPlay loop playsInline />
                      ) : (
                        <img src={form.bannerMediaUrl} alt="Banner" className="w-full h-full object-cover" />
                      )}
                      <button
                        type="button"
                        onClick={() => setForm({ ...form, bannerMediaUrl: "", bannerMediaType: "none" })}
                        className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600"
                      >
                        <X className="w-3 h-3" />
                      </button>
                      <div className="absolute bottom-1 left-1">
                        {form.bannerMediaType === "video"
                          ? <span className="text-[9px] bg-black/60 text-white px-1 py-0.5 rounded font-medium flex items-center gap-0.5"><Video className="w-2.5 h-2.5" /> VIDEO</span>
                          : <span className="text-[9px] bg-black/60 text-white px-1 py-0.5 rounded font-medium">IMG</span>}
                      </div>
                    </div>
                  )}
                  <div className="flex flex-col gap-1.5">
                    <input
                      ref={bannerMediaInputRef}
                      type="file"
                      accept="image/*,video/*"
                      onChange={handleBannerMediaUpload}
                      className="hidden"
                      id="banner-media-input"
                    />
                    <label
                      htmlFor="banner-media-input"
                      className={`flex items-center gap-2 px-4 py-2 glass-card rounded-lg text-sm text-blue-900 hover:bg-white/40 transition-colors cursor-pointer border border-white/40 ${uploadingBannerMedia ? "opacity-50 pointer-events-none" : ""}`}
                    >
                      <Upload className="w-4 h-4" />
                      {uploadingBannerMedia ? "Uploading…" : form.bannerMediaUrl ? "Change Media" : "Upload Image / Video"}
                    </label>
                    <p className="text-xs text-blue-800/50">Short MP4/GIF animations, or a festive image. Video loops automatically.</p>
                  </div>
                </div>
              </div>

              {/* Live mini preview */}
              {(form.bannerText || form.bannerMediaUrl) && (
                <div className="mt-2">
                  <p className="text-xs font-medium text-blue-900/60 mb-1.5 uppercase tracking-wider">Preview</p>
                  <div
                    className="relative w-full h-14 rounded-xl overflow-hidden flex items-center justify-center"
                    style={{ background: form.bannerMediaUrl ? undefined : form.bannerBgColor }}
                  >
                    {form.bannerMediaUrl && form.bannerMediaType === "video" && (
                      <video src={form.bannerMediaUrl} className="absolute inset-0 w-full h-full object-cover" muted autoPlay loop playsInline />
                    )}
                    {form.bannerMediaUrl && form.bannerMediaType === "image" && (
                      <img src={form.bannerMediaUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
                    )}
                    {form.bannerMediaUrl && (
                      <div className="absolute inset-0" style={{ background: `${form.bannerBgColor}99` }} />
                    )}
                    <p className="relative z-10 text-white text-sm font-medium text-center px-4 drop-shadow">{form.bannerText || "Your banner text appears here"}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* WhatsApp */}
          <div className="glass-panel-heavy rounded-2xl p-6 border-white/50">
            <h2 className="text-lg font-serif text-blue-950 mb-4 flex items-center gap-2">
              <MessageCircle className="w-5 h-5 text-green-600" /> WhatsApp Support Button
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-blue-900/80 mb-1">
                  Your WhatsApp Number (with country code)
                </label>
                <input
                  type="text"
                  value={form.whatsappNumber}
                  onChange={(e) => setForm({ ...form, whatsappNumber: e.target.value })}
                  placeholder="+256700000000"
                  className="w-full glass-card rounded-lg px-3 py-2 text-blue-950 border-white/40 focus:ring-2 focus:ring-blue-400 focus:outline-none"
                />
                <p className="text-xs text-blue-800/50 mt-1">
                  Save this number and a green WhatsApp button will appear on the storefront.
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-blue-900/80 mb-1">Default Greeting Message</label>
                <textarea
                  rows={2}
                  value={form.whatsappMessage}
                  onChange={(e) => setForm({ ...form, whatsappMessage: e.target.value })}
                  className="w-full glass-card rounded-lg px-3 py-2 text-blue-950 border-white/40 focus:ring-2 focus:ring-blue-400 focus:outline-none resize-none"
                />
              </div>
            </div>
          </div>

          {/* Mobile Money */}
          <div className="glass-panel-heavy rounded-2xl p-6 border-white/50">
            <h2 className="text-lg font-serif text-blue-950 mb-1 flex items-center gap-2">
              <Smartphone className="w-5 h-5 text-yellow-600" /> Mobile Money — Your Business Numbers
            </h2>
            <div className="flex gap-2 mb-4 glass-card rounded-xl p-3 border-blue-100/50 bg-blue-50/20">
              <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="text-xs text-blue-800/70 space-y-1">
                <p className="font-semibold">How it works:</p>
                <ol className="list-decimal ml-3 space-y-0.5">
                  <li>Customer picks MTN or Airtel at checkout</li>
                  <li>Your number shows on their screen so they know where to send money</li>
                  <li>Customer sends the exact amount to your MoMo number</li>
                  <li>You get an SMS when money arrives on your phone</li>
                  <li>Go to <strong>Orders</strong> → change status to <strong>Processing</strong> to confirm</li>
                </ol>
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-blue-900/80 mb-1">Your MTN Mobile Money Number</label>
                <input
                  type="text"
                  value={form.mtnNumber}
                  onChange={(e) => setForm({ ...form, mtnNumber: e.target.value })}
                  placeholder="+256 77X XXX XXX"
                  className="w-full glass-card rounded-lg px-3 py-2 text-blue-950 border-white/40 focus:ring-2 focus:ring-blue-400 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-blue-900/80 mb-1">Your Airtel Money Number</label>
                <input
                  type="text"
                  value={form.airtelNumber}
                  onChange={(e) => setForm({ ...form, airtelNumber: e.target.value })}
                  placeholder="+256 75X XXX XXX"
                  className="w-full glass-card rounded-lg px-3 py-2 text-blue-950 border-white/40 focus:ring-2 focus:ring-blue-400 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Currency */}
          <div className="glass-panel-heavy rounded-2xl p-6 border-white/50">
            <h2 className="text-lg font-serif text-blue-950 mb-4 flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-blue-600" /> Default Currency
            </h2>
            <select
              value={form.currencyDefault}
              onChange={(e) => setForm({ ...form, currencyDefault: e.target.value })}
              className="w-full glass-card rounded-lg px-3 py-2 text-blue-950 border-white/40 focus:ring-2 focus:ring-blue-400 focus:outline-none"
            >
              <option value="USD">USD — US Dollar</option>
              <option value="UGX">UGX — Ugandan Shilling</option>
              <option value="EUR">EUR — Euro</option>
              <option value="GBP">GBP — British Pound</option>
            </select>
          </div>

          {/* Low Stock */}
          <div className="glass-panel-heavy rounded-2xl p-6 border-white/50">
            <h2 className="text-lg font-serif text-blue-950 mb-4 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-orange-500" /> Low Stock Alert
            </h2>
            <label className="block text-sm font-medium text-blue-900/80 mb-1">Alert when stock falls below</label>
            <input
              type="number"
              min="1"
              max="100"
              value={form.lowStockThreshold}
              onChange={(e) => setForm({ ...form, lowStockThreshold: Number(e.target.value) })}
              className="w-full glass-card rounded-lg px-3 py-2 text-blue-950 border-white/40 focus:ring-2 focus:ring-blue-400 focus:outline-none"
            />
          </div>

          {/* Free Delivery Threshold */}
          <div className="glass-panel-heavy rounded-2xl p-6 border-white/50">
            <h2 className="text-lg font-serif text-blue-950 mb-1 flex items-center gap-2">
              <Truck className="w-5 h-5 text-blue-500" /> Free Delivery Threshold
            </h2>
            <p className="text-sm text-blue-800/60 mb-4">
              Orders that reach this amount qualify for free delivery anywhere in the country.
              Set to 0 to disable automatic free delivery.
            </p>
            <label className="block text-sm font-medium text-blue-900/80 mb-1">Minimum order amount for free delivery</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-800/50 text-sm">$</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.freeDeliveryThreshold}
                onChange={(e) => setForm((p) => ({ ...p, freeDeliveryThreshold: Number(e.target.value) }))}
                placeholder="0"
                className="w-full glass-card rounded-xl pl-7 pr-4 py-2.5 text-blue-950 focus:outline-none focus:ring-2 focus:ring-blue-400 border-white/40"
              />
            </div>
            {form.freeDeliveryThreshold > 0 ? (
              <p className="text-xs text-green-700 mt-1">Customers spending ${form.freeDeliveryThreshold.toFixed(2)} or more get free delivery nationwide.</p>
            ) : (
              <p className="text-xs text-blue-800/50 mt-1">Free delivery is disabled — you set shipping manually per order.</p>
            )}

            <div className="mt-5 pt-5 border-t border-white/20">
              <label className="block text-sm font-medium text-blue-900/80 mb-1">"May get free delivery" hint threshold</label>
              <p className="text-xs text-blue-800/50 mb-2">
                Orders between this amount and the nationwide threshold will see a banner saying delivery might be free depending on location.
              </p>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-800/50 text-sm">$</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.locationDeliveryThreshold}
                  onChange={(e) => setForm((p) => ({ ...p, locationDeliveryThreshold: Number(e.target.value) }))}
                  placeholder="0"
                  className="w-full glass-card rounded-xl pl-7 pr-4 py-2.5 text-blue-950 focus:outline-none focus:ring-2 focus:ring-blue-400 border-white/40"
                />
              </div>
              {form.locationDeliveryThreshold > 0 ? (
                <p className="text-xs text-orange-700 mt-1">
                  Customers spending ${form.locationDeliveryThreshold.toFixed(2)}–${form.freeDeliveryThreshold > 0 ? form.freeDeliveryThreshold.toFixed(2) : "∞"} see a "might be free depending on location" hint.
                </p>
              ) : (
                <p className="text-xs text-blue-800/50 mt-1">Set to 0 to disable the location-based hint.</p>
              )}
            </div>
          </div>

          <Button type="submit" disabled={saving} className="w-full rounded-xl bg-blue-600 hover:bg-blue-700 text-white h-12">
            {saving ? "Saving..." : "Save Settings"}
          </Button>
        </form>

        {/* Low Stock Panel */}
        <div className="glass-panel-heavy rounded-2xl p-6 border-white/50 h-fit sticky top-24">
          <h2 className="text-lg font-serif text-blue-950 mb-4 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-orange-500" /> Low Stock Products ({lowStockProducts.length})
          </h2>
          {lowStockProducts.length === 0 ? (
            <p className="text-blue-800/60 italic text-sm">All products are well-stocked.</p>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
              {lowStockProducts.map((p) => (
                <div key={p.id} className="flex items-center gap-3 glass-card rounded-xl p-3 border-white/30">
                  <div className="w-10 h-10 rounded-lg bg-white/40 flex-shrink-0 flex items-center justify-center overflow-hidden">
                    {p.imageUrl ? (
                      <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover rounded-lg" />
                    ) : (
                      <span className="text-[10px] text-blue-400">Img</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-blue-950 text-sm truncate">{p.name}</p>
                    <p className="text-xs text-blue-800/60">{p.brand}</p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full font-medium flex-shrink-0 ${p.stock === 0 ? "bg-red-100 text-red-800" : "bg-orange-100 text-orange-800"}`}>
                    {p.stock === 0 ? "Out of stock" : `${p.stock} left`}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
