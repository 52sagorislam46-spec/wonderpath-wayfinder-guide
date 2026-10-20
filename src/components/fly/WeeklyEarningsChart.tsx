import { useEffect, useState } from "react";
import { BarChart3 } from "lucide-react";
import { formatViews } from "./views";

export type DayStat = { label: string; views: number; earnings: number };

export function WeeklyEarningsChart({
  days,
  loading,
}: {
  days: DayStat[];
  loading: boolean;
}) {
  const [mode, setMode] = useState<"earnings" | "views">("earnings");
  const [active, setActive] = useState<number>(days.length - 1);
  const [grown, setGrown] = useState(false);

  useEffect(() => {
    setGrown(false);
    const t = setTimeout(() => setGrown(true), 60);
    return () => clearTimeout(t);
  }, [mode, loading]);

  const values = days.map((d) => (mode === "earnings" ? d.earnings : d.views));
  const max = Math.max(1, ...values);
  const total = values.reduce((a, b) => a + b, 0);
  const fmt = (n: number) =>
    mode === "earnings" ? `৳${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : formatViews(n);
  const sel = days[active];

  return (
    <section className="px-5 mt-5">
      <div className="rounded-3xl border border-sky-100 bg-white p-4 shadow-sm shadow-sky-50">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
            <BarChart3 size={16} className="text-sky-500" />
            Weekly {mode === "earnings" ? "Earnings" : "Views"}
          </h2>
          <div className="flex rounded-full bg-sky-50 p-0.5 text-[11px] font-semibold">
            {(["earnings", "views"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`px-3 py-1 rounded-full transition-all ${
                  mode === m ? "bg-sky-500 text-white shadow" : "text-sky-600"
                }`}
              >
                {m === "earnings" ? "আয়" : "ভিউ"}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-3 flex items-end justify-between">
          <div>
            <p className="text-2xl font-bold text-gray-900">{loading ? "…" : fmt(total)}</p>
            <p className="text-[11px] text-gray-400">গত ৭ দিন</p>
          </div>
          {sel && !loading && (
            <div className="text-right">
              <p className="text-sm font-bold text-sky-600">{fmt(values[active] ?? 0)}</p>
              <p className="text-[11px] text-gray-400">{sel.label}</p>
            </div>
          )}
        </div>

        <div className="mt-4 h-40 flex items-end gap-2">
          {days.map((d, i) => {
            const v = values[i] ?? 0;
            const h = loading ? 6 : Math.max(4, (v / max) * 100);
            const isActive = i === active;
            return (
              <button
                key={d.label + i}
                onClick={() => setActive(i)}
                className="flex-1 h-full flex flex-col items-center justify-end gap-1 group"
              >
                <span
                  className={`text-[9px] font-semibold transition-opacity duration-300 ${
                    isActive && grown && !loading ? "opacity-100 text-sky-600" : "opacity-0"
                  }`}
                >
                  {fmt(v)}
                </span>
                <div
                  className={`w-full rounded-t-xl rounded-b-md bg-gradient-to-t transition-all ease-out ${
                    isActive
                      ? "from-sky-600 to-cyan-400 shadow-md shadow-sky-200"
                      : "from-sky-400 to-sky-200 group-hover:from-sky-500"
                  }`}
                  style={{
                    height: grown ? `${h}%` : "0%",
                    transitionDuration: "700ms",
                    transitionDelay: `${i * 70}ms`,
                  }}
                />
                <span className={`text-[10px] ${isActive ? "font-bold text-sky-600" : "text-gray-400"}`}>
                  {d.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
