import { useEffect, useState } from "react";
import { collection, deleteDoc, doc, onSnapshot, query, where } from "firebase/firestore";
import { Check, Copy, Loader2, PlusCircle, Trash2 } from "lucide-react";
import { db } from "../../lib/firebase";
import { useAuth } from "./AuthContext";
import { submitRecharge, TAKA_PER_BOUGHT_STAR, usePaymentSettings, type RechargeRequest } from "./monetization";

/** User-side Add Money / Buy Stars form, paid manually via bKash or Nagad with a TrxID. */
export function AddMoneyCard() {
  const { user, profile } = useAuth();
  const settings = usePaymentSettings();
  const [kind, setKind] = useState<"wallet" | "stars">("stars");
  const [method, setMethod] = useState<"bKash" | "Nagad">("bKash");
  const [copied, setCopied] = useState(false);
  const [amount, setAmount] = useState("");
  const [sender, setSender] = useState("");
  const [trx, setTrx] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [mine, setMine] = useState<RechargeRequest[]>([]);

  useEffect(() => {
    if (!user) return;
    return onSnapshot(query(collection(db, "rechargeRequests"), where("uid", "==", user.uid)),
      (s) => setMine(s.docs.map((d) => ({ ...(d.data() as RechargeRequest), id: d.id })).sort((a, b) => b.createdAt - a.createdAt).slice(0, 5)),
      () => {});
  }, [user]);

  const DEFAULT_NUMBER = "01603650628";
  const target = (method === "bKash" ? settings?.bkash : settings?.nagad) || DEFAULT_NUMBER;
  const amt = Number(amount) || 0;
  const valid = amt >= 10 && amt <= 50000 && /^01[3-9]\d{8}$/.test(sender) && /^[A-Za-z0-9]{6,20}$/.test(trx.trim());

  const submit = async () => {
    if (!user || !valid || busy) return;
    setBusy(true); setMsg("");
    try {
      await submitRecharge({
        uid: user.uid, displayName: profile?.displayName ?? "", username: profile?.username ?? "",
        kind, method, sender, trxId: trx.trim().toUpperCase(), amount: amt,
      });
      setAmount(""); setSender(""); setTrx("");
      setMsg("রিকোয়েস্ট পাঠানো হয়েছে। যাচাইয়ের পর যোগ হবে।");
    } catch { setMsg("পাঠানো যায়নি, আবার চেষ্টা করুন।"); } finally { setBusy(false); }
  };

  const inputCls = "w-full h-11 px-3 rounded-xl border border-gray-200 text-sm outline-none focus:border-amber-400";
  return (
    <div className="rounded-2xl bg-white border border-gray-100 p-4 space-y-3">
      <h2 className="font-semibold text-gray-900 flex items-center gap-2"><PlusCircle size={18} className="text-amber-500" /> Add Money / স্টার কিনুন</h2>
      <div className="grid grid-cols-2 gap-2">
        {(["stars", "wallet"] as const).map((k) => (
          <button key={k} onClick={() => setKind(k)} className={`h-10 rounded-xl text-sm font-semibold border ${kind === k ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-700 border-gray-200"}`}>
            {k === "stars" ? "⭐ স্টার কিনুন" : "💰 ওয়ালেট রিচার্জ"}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {(["bKash", "Nagad"] as const).map((m) => (
          <button key={m} onClick={() => setMethod(m)} className={`h-10 rounded-xl text-sm font-semibold border ${method === m ? "bg-amber-500 text-white border-amber-500" : "bg-white text-gray-700 border-gray-200"}`}>{m}</button>
        ))}
      </div>
      <div className="rounded-xl bg-amber-50 p-3 text-sm text-gray-800">
        {target ? (
          <>এই {method} নম্বরে <b>Send Money</b> করুন: <span className="font-mono font-bold select-all">{target}</span>{" "}
            <button type="button" aria-label="নম্বর কপি করুন" onClick={() => {
              const done = () => { setCopied(true); setMsg("নম্বর কপি হয়েছে"); setTimeout(() => setCopied(false), 2000); };
              const fallback = () => { const ta = document.createElement("textarea"); ta.value = target; ta.style.position = "fixed"; ta.style.opacity = "0"; document.body.appendChild(ta); ta.select(); try { document.execCommand("copy"); done(); } catch { /* ignore */ } ta.remove(); };
              if (navigator.clipboard?.writeText) navigator.clipboard.writeText(target).then(done, fallback); else fallback();
            }} className={`ml-1 inline-flex items-center justify-center w-7 h-7 align-middle rounded-lg text-white ${copied ? "bg-emerald-500" : "bg-amber-500"}`}>{copied ? <Check size={15} /> : <Copy size={15} />}</button></>
        ) : (
          <>{method} নম্বর এখনো সেট করা হয়নি।</>
        )}
      </div>
      <input value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, "").slice(0, 5))} inputMode="numeric" placeholder="টাকার পরিমাণ (কমপক্ষে ৳10)" className={inputCls} />
      {kind === "stars" && amt > 0 && <p className="text-xs text-gray-500">আপনি পাবেন ⭐ {Math.floor(amt / TAKA_PER_BOUGHT_STAR)} স্টার</p>}
      <input value={sender} onChange={(e) => setSender(e.target.value.replace(/\D/g, "").slice(0, 11))} inputMode="numeric" placeholder="যে নম্বর থেকে পাঠিয়েছেন" className={inputCls} />
      <input value={trx} onChange={(e) => setTrx(e.target.value.replace(/[^A-Za-z0-9]/g, "").slice(0, 20))} placeholder="TrxID" className={`${inputCls} font-mono uppercase`} />
      <button onClick={() => void submit()} disabled={!valid || busy || !target} className="w-full h-11 rounded-xl bg-amber-500 text-white font-semibold disabled:opacity-50 flex items-center justify-center gap-2">
        {busy && <Loader2 size={16} className="animate-spin" />} রিকোয়েস্ট পাঠান
      </button>
      {msg && <p className="text-sm text-gray-700">{msg}</p>}
      {mine.length > 0 && (
        <ul className="divide-y divide-gray-100 text-sm">
          {mine.map((r) => (
            <li key={r.id} className="py-2 flex justify-between">
              <span>৳{r.amount} · {r.kind === "stars" ? "স্টার" : "ওয়ালেট"} · <span className="font-mono text-xs">{r.trxId}</span></span>
              <span className="flex items-center gap-2">
                <span className={`text-xs font-semibold ${r.status === "approved" ? "text-emerald-600" : r.status === "rejected" ? "text-red-500" : "text-amber-600"}`}>
                  {r.status === "approved" ? "Approved" : r.status === "rejected" ? "Rejected" : "Pending"}
                </span>
                {user && r.uid === user.uid && (
                  <button
                    aria-label="ইতিহাস মুছুন"
                    onClick={() => {
                      if (!window.confirm("এই ইতিহাসটি মুছে ফেলবেন?")) return;
                      deleteDoc(doc(db, "rechargeRequests", r.id)).catch(() => setMsg("মুছে ফেলা যায়নি, আবার চেষ্টা করুন।"));
                    }}
                    className="w-7 h-7 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center active:scale-90"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
