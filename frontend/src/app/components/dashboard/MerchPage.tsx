import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ShoppingBag, Plus, Search, Check, Tag, Package, Clock, Filter, X, ArrowUpRight, CheckCircle2 } from "lucide-react";
import { useTheme } from "../../theme";

const FM = "'JetBrains Mono', monospace";
const FB = "'Manrope', sans-serif";
const FC = "'Playfair Display', serif";

export interface MerchItem {
  id: string;
  name: string;
  category: "Apparel" | "Accessories" | "Swag Kits";
  price: number;
  stock: number;
  preOrders: number;
  sizes: string[];
  imageUrl: string;
  status: "ACTIVE DROP" | "IN STOCK" | "LOW STOCK" | "SOLD OUT";
}

export interface MerchOrder {
  id: string;
  studentName: string;
  usn: string;
  itemName: string;
  size: string;
  amount: number;
  utr: string;
  date: string;
  fulfilled: boolean;
}

const INITIAL_ITEMS: MerchItem[] = [
  {
    id: "m-1",
    name: "Skyline Oversized Heavyweight Hoodie (Edition '26)",
    category: "Apparel",
    price: 899,
    stock: 42,
    preOrders: 118,
    sizes: ["S", "M", "L", "XL", "2XL"],
    imageUrl: "https://images.unsplash.com/photo-1556905055-8f358a7a47b2?auto=format&fit=crop&w=600&q=80",
    status: "ACTIVE DROP",
  },
  {
    id: "m-2",
    name: "CyberHack 2026 Embroidered Lanyard & NFC Badge",
    category: "Accessories",
    price: 149,
    stock: 85,
    preOrders: 210,
    sizes: ["ONE SIZE"],
    imageUrl: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=600&q=80",
    status: "IN STOCK",
  },
  {
    id: "m-3",
    name: "Matte Black Insulated Thermal Flask (Laser Engraved)",
    category: "Accessories",
    price: 499,
    stock: 12,
    preOrders: 64,
    sizes: ["750 ML"],
    imageUrl: "https://images.unsplash.com/photo-1602143407151-7111542de6e8?auto=format&fit=crop&w=600&q=80",
    status: "LOW STOCK",
  },
  {
    id: "m-4",
    name: "Die-Cut Holographic Vinyl Sticker Pack (Set of 6)",
    category: "Swag Kits",
    price: 99,
    stock: 190,
    preOrders: 320,
    sizes: ["PACK"],
    imageUrl: "https://images.unsplash.com/photo-1572375992501-4b0892d50c69?auto=format&fit=crop&w=600&q=80",
    status: "IN STOCK",
  },
];

const INITIAL_ORDERS: MerchOrder[] = [
  {
    id: "ord-101",
    studentName: "Aditya Sharma",
    usn: "1MS23CS012",
    itemName: "Skyline Oversized Heavyweight Hoodie",
    size: "L",
    amount: 899,
    utr: "402918847291",
    date: "Today, 11:20 AM",
    fulfilled: false,
  },
  {
    id: "ord-102",
    studentName: "Ananya Rao",
    usn: "1MS23IS045",
    itemName: "Matte Black Thermal Flask",
    size: "750 ML",
    amount: 499,
    utr: "402933918204",
    date: "Today, 10:05 AM",
    fulfilled: true,
  },
  {
    id: "ord-103",
    studentName: "Rohan Varma",
    usn: "1MS22EC088",
    itemName: "CyberHack 2026 Lanyard & Badge",
    size: "ONE SIZE",
    amount: 149,
    utr: "402911048221",
    date: "Yesterday",
    fulfilled: true,
  },
  {
    id: "ord-104",
    studentName: "Priya Nair",
    usn: "1MS24AI019",
    itemName: "Holographic Sticker Pack",
    size: "PACK",
    amount: 99,
    utr: "402899471920",
    date: "Yesterday",
    fulfilled: false,
  },
];

export default function MerchPage({ club }: { club?: any }) {
  const { isDark } = useTheme();
  const [items, setItems] = useState<MerchItem[]>(INITIAL_ITEMS);
  const [orders, setOrders] = useState<MerchOrder[]>(INITIAL_ORDERS);
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // Form state
  const [newItemName, setNewItemName] = useState("");
  const [newItemCategory, setNewItemCategory] = useState<"Apparel" | "Accessories" | "Swag Kits">("Apparel");
  const [newItemPrice, setNewItemPrice] = useState("599");
  const [newItemStock, setNewItemStock] = useState("50");
  const [newItemSizes, setNewItemSizes] = useState("S, M, L, XL");
  const [newItemImage, setNewItemImage] = useState("https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=600&q=80");

  const filteredItems = items.filter((item) => {
    const matchesCat = selectedCategory === "All" || item.category === selectedCategory;
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });

  const totalRevenue = orders.reduce((sum, o) => sum + o.amount, 0);
  const totalStock = items.reduce((sum, i) => sum + i.stock, 0);
  const pendingFulfillments = orders.filter((o) => !o.fulfilled).length;

  const handleToggleFulfill = (id: string) => {
    setOrders((prev) =>
      prev.map((o) => (o.id === id ? { ...o, fulfilled: !o.fulfilled } : o))
    );
  };

  const handleCreateItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim()) return;

    const created: MerchItem = {
      id: "m-" + Date.now(),
      name: newItemName.trim(),
      category: newItemCategory,
      price: Number(newItemPrice) || 0,
      stock: Number(newItemStock) || 0,
      preOrders: 0,
      sizes: newItemSizes.split(",").map((s) => s.trim()).filter(Boolean),
      imageUrl: newItemImage.trim() || "https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=600&q=80",
      status: Number(newItemStock) > 20 ? "IN STOCK" : "LOW STOCK",
    };

    setItems([created, ...items]);
    setIsCreateModalOpen(false);
    setNewItemName("");
  };

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto space-y-8">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight" style={{ fontFamily: FC, color: isDark ? "#ffffff" : "#0f172a" }}>
            Merch Store & Inventory
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1" style={{ fontFamily: FB }}>
            Deploy custom club merch drops, track pre-orders, and manage booth fulfillment at events.
          </p>
        </div>

        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="cursor-pointer inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#F03D4E] hover:bg-[#d83544] text-white text-xs sm:text-sm font-semibold transition-all shadow-lg shadow-red-500/25 active:scale-95"
          style={{ fontFamily: FB }}
        >
          <Plus size={16} />
          <span>Launch New Drop</span>
        </button>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className={`p-5 rounded-2xl ${isDark ? "bg-[#0b0c13]" : "bg-white"} shadow-lg flex flex-col justify-between`}>
          <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400">Total Merch Revenue</span>
          <div className="mt-2 text-2xl font-bold font-mono text-emerald-400">
            ₹{totalRevenue.toLocaleString("en-IN")}
          </div>
          <span className="text-[10px] text-slate-500 mt-1 font-mono">100% verified via UPI UTR</span>
        </div>

        <div className={`p-5 rounded-2xl ${isDark ? "bg-[#0b0c13]" : "bg-white"} shadow-lg flex flex-col justify-between`}>
          <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400">Orders Processed</span>
          <div className="mt-2 text-2xl font-bold font-mono" style={{ color: isDark ? "#ffffff" : "#0f172a" }}>
            {orders.length} Orders
          </div>
          <span className="text-[10px] text-slate-500 mt-1 font-mono">From registered attendees</span>
        </div>

        <div className={`p-5 rounded-2xl ${isDark ? "bg-[#0b0c13]" : "bg-white"} shadow-lg flex flex-col justify-between`}>
          <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400">In-Stock Inventory</span>
          <div className="mt-2 text-2xl font-bold font-mono text-indigo-400">
            {totalStock} Units
          </div>
          <span className="text-[10px] text-slate-500 mt-1 font-mono">Across {items.length} active catalog SKUs</span>
        </div>

        <div className={`p-5 rounded-2xl ${isDark ? "bg-[#0b0c13]" : "bg-white"} shadow-lg flex flex-col justify-between`}>
          <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400">Pending Booth Pickups</span>
          <div className={`mt-2 text-2xl font-bold font-mono ${pendingFulfillments > 0 ? "text-amber-400" : "text-emerald-400"}`}>
            {pendingFulfillments} Pending
          </div>
          <span className="text-[10px] text-slate-500 mt-1 font-mono">Awaiting student collection</span>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-white/5 backdrop-blur-md overflow-x-auto">
          {["All", "Apparel", "Accessories", "Swag Kits"].map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`cursor-pointer px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                selectedCategory === cat
                  ? "bg-[#F03D4E] text-white shadow-md shadow-red-500/25 font-semibold"
                  : "text-slate-400 hover:text-white"
              }`}
              style={{ fontFamily: FB }}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="relative min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search merchandise..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`w-full pl-9 pr-4 py-2 rounded-xl text-xs outline-none transition-all ${
              isDark ? "bg-white/5 text-white placeholder-slate-500 focus:bg-white/10" : "bg-slate-100 text-slate-900 placeholder-slate-400"
            }`}
            style={{ fontFamily: FB }}
          />
        </div>
      </div>

      {/* Merch Catalog Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {filteredItems.map((item) => (
          <div
            key={item.id}
            className={`group rounded-3xl overflow-hidden transition-all duration-300 flex flex-col justify-between shadow-xl ${
              isDark ? "bg-[#0b0c13] hover:bg-[#0e101a]" : "bg-white hover:shadow-2xl"
            }`}
          >
            <div>
              {/* Image Container */}
              <div className="relative h-48 w-full overflow-hidden bg-black/40">
                <img
                  src={item.imageUrl}
                  alt={item.name}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  onError={(e) => {
                    e.currentTarget.src = "https://images.unsplash.com/photo-1556905055-8f358a7a47b2?auto=format&fit=crop&w=600&q=80";
                  }}
                />
                <span
                  className={`absolute top-3 right-3 px-2.5 py-1 rounded-full text-[9px] font-mono font-bold tracking-wider uppercase ${
                    item.status === "ACTIVE DROP"
                      ? "bg-red-500 text-white shadow-lg"
                      : item.status === "LOW STOCK"
                      ? "bg-amber-500 text-white"
                      : "bg-emerald-500 text-white"
                  }`}
                >
                  {item.status}
                </span>
                <span className="absolute bottom-3 left-3 px-2 py-0.5 rounded-md bg-black/70 backdrop-blur-md text-[10px] font-mono text-slate-300">
                  {item.category}
                </span>
              </div>

              {/* Details */}
              <div className="p-5">
                <h3 className="text-sm font-bold leading-snug line-clamp-2" style={{ fontFamily: FB, color: isDark ? "#ffffff" : "#0f172a" }}>
                  {item.name}
                </h3>
                <div className="mt-3 flex items-baseline justify-between">
                  <div className="text-lg font-bold font-mono text-emerald-400">
                    ₹{item.price}
                  </div>
                  <span className="text-[11px] font-mono text-slate-400">
                    {item.stock} in stock
                  </span>
                </div>

                {/* Sizes badge row */}
                <div className="mt-3 flex flex-wrap gap-1">
                  {item.sizes.map((s) => (
                    <span key={s} className="px-2 py-0.5 rounded text-[9px] font-mono bg-white/5 text-slate-400">
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-5 pt-0 flex items-center justify-between gap-2 border-t border-white/5 mt-2">
              <span className="text-[10px] font-mono text-slate-400">
                {item.preOrders} pre-ordered
              </span>
              <button
                onClick={() => {
                  setItems((prev) =>
                    prev.map((it) => (it.id === item.id ? { ...it, stock: it.stock + 10 } : it))
                  );
                }}
                className="cursor-pointer text-[11px] font-mono px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 transition-colors"
              >
                + Restock 10
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Pre-Orders & Booth Pickup Management */}
      <div className={`p-6 sm:p-7 rounded-3xl ${isDark ? "bg-[#0b0c13]" : "bg-white"} shadow-xl space-y-5`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold" style={{ fontFamily: FB, color: isDark ? "#ffffff" : "#0f172a" }}>
              Student Pre-Orders & Booth Fulfillment
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Verify UTR transaction proofs and mark merch picked up at the event welcome booth.
            </p>
          </div>
          <span className="text-xs font-mono text-slate-400 self-start sm:self-auto">
            {orders.length} Total Orders
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs" style={{ fontFamily: FB }}>
            <thead>
              <tr className="border-b border-white/10 text-slate-400 font-mono text-[11px]">
                <th className="pb-3 font-medium">STUDENT</th>
                <th className="pb-3 font-medium">ITEM & SIZE</th>
                <th className="pb-3 font-medium">AMOUNT</th>
                <th className="pb-3 font-medium">UTR REFERENCE</th>
                <th className="pb-3 font-medium">DATE</th>
                <th className="pb-3 font-medium text-right">STATUS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {orders.map((ord) => (
                <tr key={ord.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="py-3.5">
                    <div className="font-semibold text-white">{ord.studentName}</div>
                    <div className="text-[10px] text-slate-400 font-mono">{ord.usn}</div>
                  </td>
                  <td className="py-3.5">
                    <div className="text-slate-200">{ord.itemName}</div>
                    <span className="text-[10px] font-mono text-indigo-400">Size: {ord.size}</span>
                  </td>
                  <td className="py-3.5 font-mono font-bold text-emerald-400">
                    ₹{ord.amount}
                  </td>
                  <td className="py-3.5 font-mono text-slate-400 text-[11px]">
                    {ord.utr}
                  </td>
                  <td className="py-3.5 font-mono text-slate-400 text-[11px]">
                    {ord.date}
                  </td>
                  <td className="py-3.5 text-right">
                    <button
                      onClick={() => handleToggleFulfill(ord.id)}
                      className={`cursor-pointer inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-mono font-semibold transition-all ${
                        ord.fulfilled
                          ? "bg-emerald-500/15 text-emerald-400"
                          : "bg-amber-500/15 text-amber-400 hover:bg-amber-500/25"
                      }`}
                    >
                      <CheckCircle2 size={12} />
                      <span>{ord.fulfilled ? "PICKED UP" : "MARK PICKED UP"}</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Launch New Merch Drop */}
      <AnimatePresence>
        {isCreateModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className={`w-full max-w-lg p-6 sm:p-7 rounded-3xl shadow-2xl ${
                isDark ? "bg-[#0d0e17] text-white" : "bg-white text-slate-900"
              }`}
            >
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-lg font-bold" style={{ fontFamily: FB }}>
                  Launch New Merchandise Drop
                </h3>
                <button
                  onClick={() => setIsCreateModalOpen(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleCreateItem} className="space-y-4 text-xs" style={{ fontFamily: FB }}>
                <div>
                  <label className="block text-slate-400 mb-1">Item Title</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Skyline Club Winter Varsity Jacket"
                    value={newItemName}
                    onChange={(e) => setNewItemName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white outline-none focus:border-red-500/50"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-400 mb-1">Category</label>
                    <select
                      value={newItemCategory}
                      onChange={(e) => setNewItemCategory(e.target.value as any)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white outline-none"
                    >
                      <option value="Apparel" className="bg-[#0b0c13]">Apparel</option>
                      <option value="Accessories" className="bg-[#0b0c13]">Accessories</option>
                      <option value="Swag Kits" className="bg-[#0b0c13]">Swag Kits</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1">Price (₹)</label>
                    <input
                      type="number"
                      required
                      value={newItemPrice}
                      onChange={(e) => setNewItemPrice(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white outline-none font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-400 mb-1">Initial Stock Count</label>
                    <input
                      type="number"
                      required
                      value={newItemStock}
                      onChange={(e) => setNewItemStock(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white outline-none font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1">Available Sizes</label>
                    <input
                      type="text"
                      placeholder="S, M, L, XL"
                      value={newItemSizes}
                      onChange={(e) => setNewItemSizes(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white outline-none font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">Mockup Image URL</label>
                  <input
                    type="url"
                    value={newItemImage}
                    onChange={(e) => setNewItemImage(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white outline-none font-mono"
                  />
                </div>

                <div className="pt-3 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setIsCreateModalOpen(false)}
                    className="px-4 py-2 text-slate-400 hover:text-white text-xs font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="cursor-pointer px-5 py-2.5 rounded-xl bg-[#F03D4E] hover:bg-[#d83544] text-white text-xs font-semibold shadow-lg shadow-red-500/25"
                  >
                    Publish Merch Drop
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
