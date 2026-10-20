import { ShoppingBag } from "lucide-react";
import type { Post } from "./types";

export type PostProduct = NonNullable<Post["product"]>;

/** Turns a WhatsApp number or website into a safe, clickable order link. */
export function productOrderLink(p: PostProduct): string {
  const raw = (p.link || "").trim();
  if (!raw) return "";
  const digits = raw.replace(/[^\d]/g, "");
  const looksPhone = /^[+\d\s()-]+$/.test(raw) && digits.length >= 8;
  if (looksPhone || (/wa\.me|whatsapp/i.test(raw) && !/^https?:\/\//i.test(raw))) {
    const num = digits.startsWith("0") ? `88${digits}` : digits;
    const msg = encodeURIComponent(`আমি "${p.title}" (৳${p.price}) অর্ডার করতে চাই।`);
    return `https://wa.me/${num}?text=${msg}`;
  }
  if (/^https?:\/\//i.test(raw)) return raw;
  return `https://${raw}`;
}

export function ProductCard({ product, dark = false }: { product: PostProduct; dark?: boolean }) {
  const href = productOrderLink(product);
  const isWa = href.includes("wa.me");
  return (
    <a
      href={href || undefined}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className={`mt-2 flex items-center gap-3 rounded-2xl p-2 border ${
        dark ? "bg-black/40 border-white/20 text-white backdrop-blur" : "bg-white border-gray-100 shadow-sm text-gray-900"
      }`}
    >
      {product.imageUrl ? (
        <img src={product.imageUrl} alt={product.title} className="w-14 h-14 rounded-xl object-cover shrink-0" />
      ) : (
        <span className="w-14 h-14 rounded-xl bg-amber-50 text-amber-500 flex items-center justify-center shrink-0">
          <ShoppingBag size={22} />
        </span>
      )}
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-semibold truncate">{product.title}</span>
        <span className={`block text-sm font-bold ${dark ? "text-amber-300" : "text-emerald-600"}`}>৳{product.price}</span>
      </span>
      <span className="shrink-0 h-9 px-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs font-bold flex items-center gap-1">
        <ShoppingBag size={14} /> {isWa ? "Order Now" : "Buy Now"}
      </span>
    </a>
  );
}
