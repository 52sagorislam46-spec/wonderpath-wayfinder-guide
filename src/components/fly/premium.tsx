import { useEffect, useState } from "react";
import { BadgeCheck, Crown, Loader2, Sparkles } from "lucide-react";
import { doc, runTransaction } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { useAuth } from "./AuthContext";

/** Global "Fly Premium" plans, paid from the wallet balance. */
export const PREMIUM_PLANS = [
  { id: "month", price: 100, days: 30, label: "মাসিক" },
  { id: "year", price: 1000, days: 365, label: "বাৎসরিক" },
] as const;

export function isPremium(profile: unknown): boolean {
  const u = Number((profile as { premiumUntil?: number } | null)?.premiumUntil ?? 0);
  return u > Date.now();
}

export async function buyPremium(uid: string, planIdx: number): Promise<"ok" | "insufficient"> {
  const plan = PREMIUM_PLANS[planIdx];
  if (!plan) return "insufficient";
  const ref = doc(db, "users", uid);
  return runTransaction(db, async (tx) => {
    const d = ((await tx.get(ref)).data() ?? {}) as { walletBalance?: number; premiumUntil?: number };
    const bal = Number(d.walletBalance ?? 0);
    if (bal < plan.price) return "insufficient" as const;
    const start = Math.max(Date.now(), Number(d.premiumUntil ?? 0));
    tx.update(ref, { walletBalance: bal - plan.price, premiumUntil: start + plan.days * 86400000 });
    return "ok" as const;
  });
}

/** Blue verified tick for Premium members. */
export function PremiumBadge({ size = 14 }: { size?: number }) {
  return (
    <span title="Fly Premium · Verified" className="inline-flex items-center ml-1 align-middle text-sky-500">
      <BadgeCheck size={size} className="fill-sky-500 text-white" />
    </span>
  );
}

export const PREMIUM_STICKERS = ["🦅", "💎", "🚀", "🌈", "🔥", "👑", "🦄", "⚡", "🎉", "💫", "🌟", "🥇"];
export const PREMIUM_REACTIONS = ["❤️‍🔥", "😍", "🤩", "🥳", "💯", "🫶"];

const THEME_KEY = "fly-premium-theme";
/** Applies the special Premium app theme when the member has it switched on. */
export function usePremiumTheme(active: boolean) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    setOn(localStorage.getItem(THEME_KEY) === "1");
  }, []);
  useEffect(() => {
    document.documentElement.classList.toggle("fly-premium-theme", active && on);
  }, [active, on]);
  const toggle = () => {
    const next = !on;
    localStorage.setItem(THEME_KEY, next ? "1" : "0");
    setOn(next);
  };
  return { on, toggle };
}

export function PremiumCard() {
  const { user, profile, refreshProfile } = useAuth();
  const active = isPremium(profile);
  const theme = usePremiumTheme(active);
  const [busy, setBusy] = useState<number | null>(null);
  const [msg, setMsg] = useState("");
  const until = Number((profile as { premiumUntil?: number } | null)?.premiumUntil ?? 0);

  const buy = async (i: number) => {
    if (!user || busy !== null) return;
    const p = PREMIUM_PLANS[i]!;
    if (!window.confirm(`Fly Premium (${p.label}) — ৳${p.price} ওয়ালেট থেকে কাটা হবে। নিশ্চিত?`)) return;
    setBusy(i);
    setMsg("");
    try {
      const r = await buyPremium(user.uid, i);
      if (r === "insufficient") setMsg("ওয়ালেটে যথেষ্ট টাকা নেই — আগে রিচার্জ করুন।");
      else {
        await refreshProfile();
        setMsg("🎉 আপনি এখন Fly Premium মেম্বার!");
      }
    } catch {
      setMsg("কেনা যায়নি, আবার চেষ্টা করুন।");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="rounded-2xl border border-sky-100 bg-gradient-to-br from-sky-50 to-cyan-50 p-4 space-y-3">
      <h2 className="font-semibold text-gray-900 flex items-center gap-2">
        <Crown size={18} className="text-sky-500" /> Fly Premium {active && <PremiumBadge size={16} />}
      </h2>
      <ul className="text-sm text-gray-700 space-y-1">
        <li>🚫 সম্পূর্ণ বিজ্ঞাপনমুক্ত অ্যাপ</li>
        <li>✔️ প্রোফাইলে ব্লু ভেরিফায়েড ব্যাজ</li>
        <li>🎨 স্পেশাল অ্যাপ থিম, এক্সক্লুসিভ স্টিকার ও অ্যানিমেটেড রিঅ্যাকশন</li>
      </ul>
      {active ? (
        <>
          <p className="text-xs text-gray-600">মেয়াদ: {new Date(until).toLocaleDateString()} পর্যন্ত</p>
          <button
            type="button"
            onClick={theme.toggle}
            className="w-full h-10 rounded-xl bg-white border border-sky-200 text-sm font-semibold text-sky-700 flex items-center justify-center gap-2"
          >
            <Sparkles size={16} /> Premium থিম {theme.on ? "বন্ধ করুন" : "চালু করুন"}
          </button>
          <div>
            <p className="text-xs font-semibold text-gray-600 mb-1">এক্সক্লুসিভ স্টিকার</p>
            <div className="flex flex-wrap gap-2 text-2xl">
              {PREMIUM_STICKERS.map((s) => <span key={s}>{s}</span>)}
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-600 mb-1">অ্যানিমেটেড রিঅ্যাকশন</p>
            <div className="flex gap-3 text-2xl">
              {PREMIUM_REACTIONS.map((r, i) => (
                <span key={r} className="inline-block animate-bounce" style={{ animationDelay: `${i * 120}ms` }}>{r}</span>
              ))}
            </div>
          </div>
        </>
      ) : null}
      <div className="grid grid-cols-2 gap-2">
        {PREMIUM_PLANS.map((p, i) => (
          <button
            key={p.id}
            type="button"
            onClick={() => void buy(i)}
            disabled={busy !== null}
            className="h-14 rounded-xl bg-sky-500 text-white font-semibold disabled:opacity-50 flex flex-col items-center justify-center"
          >
            {busy === i ? <Loader2 size={16} className="animate-spin" /> : <>
              <span className="text-sm">{active ? "মেয়াদ বাড়ান" : "কিনুন"} · {p.label}</span>
              <span className="text-xs opacity-90">৳{p.price}</span>
            </>}
          </button>
        ))}
      </div>
      {msg && <p className="text-sm text-gray-700">{msg}</p>}
    </div>
  );
}
