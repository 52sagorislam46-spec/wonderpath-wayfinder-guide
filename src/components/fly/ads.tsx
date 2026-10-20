import { useEffect, useState } from "react";
import { doc, increment, setDoc } from "firebase/firestore";
import { Gift, Loader2, Megaphone, X } from "lucide-react";
import { db } from "../../lib/firebase";
import adVideo from "../../assets/fly-ad-49s.mp4.asset.json";

/** Temporarily disabled: watching ads no longer grants stars. Set true to re-enable. */
export const REWARDED_STARS_ENABLED = false;
import { useAuth } from "./AuthContext";
import { isPremium } from "./premium";

/** Premium members browse ad-free. Set from the signed-in profile. */
let adFree = false;
export function setAdFree(v: boolean) {
  adFree = v;
}

/**
 * Ad configuration. Fill in real IDs from Google AdMob/AdSense and
 * Meta Audience Network when the accounts are approved. Until then a
 * built-in "house ad" is shown so layout and rewards work end to end.
 */
export const AD_CONFIG = {
  admob: { appId: "", bannerUnit: "", interstitialUnit: "", rewardedUnit: "" },
  meta: { placementBanner: "", placementInterstitial: "", placementRewarded: "" },
  rewardStars: 5,
  rewardSeconds: 10, // 5–15s
  reelsInterstitialEvery: 5,
  feedAdEvery: 6,
  chatAdEvery: 7,
  caps: {
    rewardedPerDay: 10,
    interstitialPerDay: 12,
    interstitialCooldownMs: 90_000,
  },
};

type Kind = "rewarded" | "interstitial";
const KEY = "fly-ad-caps";

function today() {
  return new Date().toISOString().slice(0, 10);
}
function readCaps(): { day: string; rewarded: number; interstitial: number; lastInterstitial: number } {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "null");
    if (v && v.day === today()) return v;
  } catch {
    /* ignore */
  }
  return { day: today(), rewarded: 0, interstitial: 0, lastInterstitial: 0 };
}
function writeCaps(v: ReturnType<typeof readCaps>) {
  try {
    localStorage.setItem(KEY, JSON.stringify(v));
  } catch {
    /* ignore */
  }
}

/** Frequency capping: can this ad type be shown right now? */
export function canShow(kind: Kind, now = Date.now()): boolean {
  const c = readCaps();
  if (kind === "rewarded") return c.rewarded < AD_CONFIG.caps.rewardedPerDay;
  return (
    c.interstitial < AD_CONFIG.caps.interstitialPerDay &&
    now - c.lastInterstitial >= AD_CONFIG.caps.interstitialCooldownMs
  );
}
function recordShown(kind: Kind) {
  const c = readCaps();
  if (kind === "rewarded") c.rewarded += 1;
  else {
    c.interstitial += 1;
    c.lastInterstitial = Date.now();
  }
  writeCaps(c);
}
export function rewardedLeftToday() {
  return Math.max(0, AD_CONFIG.caps.rewardedPerDay - readCaps().rewarded);
}

// ---- Reels interstitial trigger ----
let reelCount = 0;
const listeners = new Set<() => void>();
/** Call whenever a new reel comes into view. */
export function onReelSeen() {
  if (adFree) return;
  reelCount += 1;
  if (reelCount % AD_CONFIG.reelsInterstitialEvery === 0 && canShow("interstitial")) {
    recordShown("interstitial");
    listeners.forEach((l) => l());
  }
}

/** Full-screen video ad creative (your uploaded ad video). */
function AdVideo({ onEnded }: { onEnded?: () => void }) {
  return (
    <video
      src={adVideo.url}
      autoPlay
      playsInline
      loop={!onEnded}
      onEnded={onEnded}
      className="max-h-full max-w-full object-contain"
    />
  );
}

function AdCreative({ compact }: { compact?: boolean }) {
  return (
    <div className={`flex items-center gap-3 ${compact ? "" : "flex-col text-center"}`}>
      <div className="rounded-2xl bg-gradient-to-br from-sky-400 to-indigo-500 p-3 text-white">
        <Megaphone size={compact ? 18 : 36} />
      </div>
      <div>
        <p className="font-semibold text-sm">এখানে আপনার বিজ্ঞাপন</p>
        <p className="text-xs opacity-70">Fly-তে বিজ্ঞাপন দিয়ে লাখো মানুষের কাছে পৌঁছান</p>
      </div>
    </div>
  );
}

/** Full-screen ad shown after every few reels. Mount once in the app. */
export function InterstitialHost() {
  const { profile } = useAuth();
  const premium = isPremium(profile);
  useEffect(() => setAdFree(premium), [premium]);
  const [open, setOpen] = useState(false);
  const [left, setLeft] = useState(5);
  useEffect(() => {
    const l = () => {
      setLeft(5);
      setOpen(true);
    };
    listeners.add(l);
    return () => void listeners.delete(l);
  }, []);
  useEffect(() => {
    if (!open || left <= 0) return;
    const t = setTimeout(() => setLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [open, left]);
  if (!open || premium) return null;
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 text-white">
      <span className="absolute top-4 left-4 rounded bg-white/20 px-2 py-0.5 text-[10px]">Ad</span>
      <button
        type="button"
        disabled={left > 0}
        onClick={() => setOpen(false)}
        className="absolute bottom-8 right-4 z-10 flex items-center gap-1 rounded-full bg-white/25 px-4 py-2 text-sm font-semibold"
      >
        {left > 0 ? `স্কিপ ${left}s` : (<>স্কিপ <X size={16} /></>)}
      </button>
      <AdVideo onEnded={() => setOpen(false)} />
    </div>
  );
}

/** Small banner / native ad for feed and chat list. */
export function BannerAd() {
  const { profile } = useAuth();
  if (isPremium(profile)) return null;
  return (
    <div className="mx-3 my-2 rounded-2xl border border-gray-100 bg-gray-50 p-3 text-gray-900">
      <div className="mb-1 text-[10px] text-gray-400">Sponsored · Ad</div>
      <AdCreative compact />
    </div>
  );
}

/** Watch a short ad to earn free stars. */
export function RewardedAdCard({ uid }: { uid: string }) {
  const [watching, setWatching] = useState(false);
  const [left, setLeft] = useState(0);
  const [msg, setMsg] = useState("");
  const [remaining, setRemaining] = useState<number | null>(null);
  useEffect(() => setRemaining(rewardedLeftToday()), []);
  useEffect(() => {
    if (!watching) return;
    if (left <= 0) {
      setWatching(false);
      recordShown("rewarded");
      setRemaining(rewardedLeftToday());
      setDoc(doc(db, "users", uid), { stars: increment(AD_CONFIG.rewardStars) }, { merge: true })
        .then(() => setMsg(`🎉 ${AD_CONFIG.rewardStars} স্টার যোগ হয়েছে!`))
        .catch(() => setMsg("স্টার যোগ করা যায়নি, আবার চেষ্টা করুন।"));
      return;
    }
    const t = setTimeout(() => setLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [watching, left, uid]);

  const start = () => {
    setMsg("");
    if (!canShow("rewarded")) {
      setMsg("আজকের বিজ্ঞাপন সীমা শেষ। কাল আবার চেষ্টা করুন।");
      return;
    }
    setLeft(AD_CONFIG.rewardSeconds);
    setWatching(true);
  };

  return (
    <div className="rounded-2xl bg-white border border-gray-100 p-4 space-y-2">
      <h2 className="font-semibold text-gray-900 flex items-center gap-2">
        <Gift size={18} className="text-amber-500" /> বিজ্ঞাপন দেখে ফ্রি স্টার
      </h2>
      <p className="text-sm text-gray-500">
        {AD_CONFIG.rewardSeconds} সেকেন্ডের বিজ্ঞাপন দেখলে {AD_CONFIG.rewardStars} স্টার পাবেন।
        {remaining !== null && ` আজ বাকি: ${remaining}টি`}
      </p>
      <button
        type="button"
        onClick={start}
        disabled={watching}
        className="w-full rounded-xl bg-amber-500 py-2 text-sm font-semibold text-white disabled:opacity-60"
      >
        {watching ? "বিজ্ঞাপন চলছে…" : "বিজ্ঞাপন দেখুন"}
      </button>
      {msg && <p className="text-sm text-gray-700">{msg}</p>}
      {watching && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 text-white">
          <span className="absolute top-4 left-4 rounded bg-white/20 px-2 py-0.5 text-[10px]">Ad</span>
          <span className="absolute top-4 right-4 flex items-center gap-1 rounded-full bg-white/20 px-3 py-1 text-xs">
            <Loader2 size={12} className="animate-spin" /> {left}s
          </span>
          <AdVideo />
        </div>
      )}
    </div>
  );
}
