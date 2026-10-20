import type { BcsQuestion } from './bcs-questions';

// Procedurally generated math questions: exact answers computed in code, so they are always correct and cost nothing.
const SUBJECT = 'গাণিতিক যুক্তি ও মানসিক দক্ষতা';
const bnDigits = '০১২৩৪৫৬৭৮৯';
export const bn = (n: number | string) => String(n).replace(/\d/g, d => bnDigits[+d]!);

function seeded(seed: number) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

function make(q: string, correct: number, distractors: number[], explain: string, pos: number, unit = ''): BcsQuestion | null {
  const uniq = [...new Set(distractors.filter(d => d !== correct && d > 0))].slice(0, 3);
  if (uniq.length < 3) return null;
  const nums = [...uniq];
  nums.splice(pos, 0, correct);
  const options = nums.map(n => bn(n) + unit) as [string, string, string, string];
  return { subject: SUBJECT, q, options, answer: pos as 0 | 1 | 2 | 3, explain };
}
const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);
// Euclid division steps written out, e.g. "৪৮ ÷ ১৮ = ২ বাকি ১২, ১৮ ÷ ১২ = ১ বাকি ৬, ১২ ÷ ৬ = ২ বাকি ০".
function euclid(a: number, b: number) { let [x, y] = a > b ? [a, b] : [b, a]; const s: string[] = []; while (y) { s.push(`${bn(x)} ÷ ${bn(y)} = ${bn(Math.floor(x / y))} বাকি ${bn(x % y)}`); [x, y] = [y, x % y]; } return s.join(', '); }

export function generateMathQuestions(): BcsQuestion[] {
  const r = seeded(46);
  const pos = () => Math.floor(r() * 4);
  const out: BcsQuestion[] = [];
  const push = (q: BcsQuestion | null) => { if (q) out.push(q); };

  // Percentages: p% of n
  for (const p of [5, 10, 12, 15, 20, 25, 30, 40, 45, 50, 60, 75]) for (let n = 40; n <= 1000; n += 40) {
    const a = (p * n) / 100; if (!Number.isInteger(a)) continue;
    push(make(`${bn(n)} এর ${bn(p)}% কত?`, a, [a + 10, a - 5, a * 2, a + n / 20], `ধাপ ১: ${bn(n)} × ${bn(p)} = ${bn(n * p)}; ধাপ ২: ${bn(n * p)} ÷ ১০০ = ${bn(a)}।`, pos()));
  }
  // Simple interest
  for (const P of [500, 1000, 1500, 2000, 2500, 3000, 4000, 5000, 8000, 10000]) for (const R of [4, 5, 6, 8, 10, 12]) for (const T of [2, 3, 4, 5]) {
    const I = (P * R * T) / 100; if (!Number.isInteger(I)) continue;
    push(make(`বার্ষিক ${bn(R)}% সরল মুনাফায় ${bn(P)} টাকার ${bn(T)} বছরের মুনাফা কত টাকা?`, I, [I + P / 20, I - R * 10, (P * R) / 100, I + 100], `মুনাফা = আসল × হার × সময় ÷ ১০০। ধাপ ১: ${bn(P)} × ${bn(R)} = ${bn(P * R)}; ধাপ ২: ${bn(P * R)} × ${bn(T)} = ${bn(P * R * T)}; ধাপ ৩: ${bn(P * R * T)} ÷ ১০০ = ${bn(I)} টাকা।`, pos()));
  }
  // Speed / distance
  for (const v of [20, 30, 36, 40, 45, 50, 54, 60, 72, 80]) for (const t of [2, 3, 4, 5, 6]) {
    const d = v * t;
    push(make(`একটি গাড়ি ঘণ্টায় ${bn(v)} কি.মি. বেগে চললে ${bn(t)} ঘণ্টায় কত কি.মি. যাবে?`, d, [d + v, d - v, d + 10, v + t], `দূরত্ব = বেগ × সময় = ${bn(v)} × ${bn(t)} = ${bn(d)} কি.মি.।`, pos()));
  }
  // km/h to m/s
  for (const v of [18, 36, 54, 72, 90, 108, 126, 144, 162, 180]) {
    const m = (v * 5) / 18;
    push(make(`ঘণ্টায় ${bn(v)} কি.মি. বেগ সমান সেকেন্ডে কত মিটার?`, m, [m + 5, m * 2, m - 2, m + 3], `১ কি.মি. = ১০০০ মি., ১ ঘণ্টা = ৩৬০০ সে., তাই ৫/১৮ দিয়ে গুণ। ধাপ ১: ${bn(v)} × ৫ = ${bn(v * 5)}; ধাপ ২: ${bn(v * 5)} ÷ ১৮ = ${bn(m)} মি./সে.।`, pos()));
  }
  // LCM / HCF
  for (let a = 6; a <= 48; a += 2) for (let b = a + 3; b <= 60; b += 5) {
    const g = gcd(a, b), l = (a * b) / g;
    if (g > 1) push(make(`${bn(a)} ও ${bn(b)} এর গ.সা.গু. কত?`, g, [g + 1, g * 2, g + 3, a - b + 100], `ভাগ পদ্ধতি: ${euclid(a, b)}। শেষ ভাজক ${bn(g)}, তাই গ.সা.গু. = ${bn(g)}।`, pos()));
    push(make(`${bn(a)} ও ${bn(b)} এর ল.সা.গু. কত?`, l, [l + a, l * 2, a * b + 1, l - g + 1 === l ? l + 7 : l - g + 1], `ধাপ ১: গ.সা.গু. বের করি — ${euclid(a, b)}, গ.সা.গু. = ${bn(g)}; ধাপ ২: ${bn(a)} × ${bn(b)} = ${bn(a * b)}; ধাপ ৩: ল.সা.গু. = ${bn(a * b)} ÷ ${bn(g)} = ${bn(l)}।`, pos()));
  }
  // Averages
  for (let s = 5; s <= 95; s += 3) for (const k of [3, 5, 7]) {
    const nums = Array.from({ length: k }, (_, i) => s + i * 2); const avg = s + (k - 1);
    push(make(`${nums.map(bn).join(', ')} — এই সংখ্যাগুলোর গড় কত?`, avg, [avg + 1, avg - 1, avg + 2, avg + k], `ধাপ ১: যোগফল = ${nums.map(bn).join(' + ')} = ${bn(avg * k)}; ধাপ ২: গড় = যোগফল ÷ সংখ্যা = ${bn(avg * k)} ÷ ${bn(k)} = ${bn(avg)}।`, pos()));
  }
  // Squares and roots
  for (let n = 11; n <= 99; n++) {
    push(make(`${bn(n * n)} এর বর্গমূল কত?`, n, [n + 1, n - 1, n + 2, n + 10], `${bn(n)} × ${bn(n)} = ${bn(n * n)}, তাই বর্গমূল ${bn(n)}।`, pos()));
  }
  // Profit
  for (const c of [100, 200, 250, 400, 500, 800, 1000, 1200, 1500, 2000]) for (const p of [5, 10, 15, 20, 25]) {
    const s = c + (c * p) / 100; if (!Number.isInteger(s)) continue;
    push(make(`${bn(c)} টাকার একটি জিনিস ${bn(p)}% লাভে বিক্রি করলে বিক্রয়মূল্য কত টাকা?`, s, [s + c / 20, s - c / 10, c + p, s + 10], `ধাপ ১: লাভ = ${bn(c)} × ${bn(p)} ÷ ১০০ = ${bn(s - c)} টাকা; ধাপ ২: বিক্রয়মূল্য = ক্রয়মূল্য + লাভ = ${bn(c)} + ${bn(s - c)} = ${bn(s)} টাকা।`, pos()));
  }
  // Rectangle area/perimeter
  for (let l = 5; l <= 40; l += 3) for (let w = 3; w < l; w += 4) {
    push(make(`একটি আয়তক্ষেত্রের দৈর্ঘ্য ${bn(l)} মি. ও প্রস্থ ${bn(w)} মি. হলে ক্ষেত্রফল কত বর্গমিটার?`, l * w, [2 * (l + w), l * w + l, l * w - w, l + w], `ক্ষেত্রফল = দৈর্ঘ্য × প্রস্থ = ${bn(l)} × ${bn(w)} = ${bn(l * w)} বর্গমিটার।`, pos()));
    push(make(`একটি আয়তক্ষেত্রের দৈর্ঘ্য ${bn(l)} মি. ও প্রস্থ ${bn(w)} মি. হলে পরিসীমা কত মিটার?`, 2 * (l + w), [l * w, l + w, 2 * (l + w) + 2, 2 * l + w], `পরিসীমা = ২ × (দৈর্ঘ্য + প্রস্থ)। ধাপ ১: ${bn(l)} + ${bn(w)} = ${bn(l + w)}; ধাপ ২: ২ × ${bn(l + w)} = ${bn(2 * (l + w))} মিটার।`, pos()));
  }
  // Ratio sharing
  for (const total of [120, 180, 240, 300, 360, 600, 900, 1200]) for (const [x, y] of [[1, 2], [2, 3], [3, 5], [1, 3], [3, 7], [1, 5]] as const) {
    const part = (total / (x + y)) * x; if (!Number.isInteger(part)) continue;
    push(make(`${bn(total)} টাকা দুইজনের মধ্যে ${bn(x)}:${bn(y)} অনুপাতে ভাগ করলে প্রথমজন কত টাকা পাবে?`, part, [total - part, part + 10, total / 2 === part ? part + 20 : total / 2, part * 2], `ধাপ ১: মোট অংশ = ${bn(x)} + ${bn(y)} = ${bn(x + y)}; ধাপ ২: ১ অংশ = ${bn(total)} ÷ ${bn(x + y)} = ${bn(total / (x + y))} টাকা; ধাপ ৩: প্রথমজন = ${bn(total / (x + y))} × ${bn(x)} = ${bn(part)} টাকা।`, pos()));
  }
  // Mental multiplication
  for (let a = 12; a <= 49; a++) for (let b = 11; b <= 29; b += 2) {
    const p = a * b;
    push(make(`${bn(a)} × ${bn(b)} = কত?`, p, [p + 10, p - a, p + b, p + 100], `${bn(b)} = ${bn(b - b % 10)} + ${bn(b % 10)}। ধাপ ১: ${bn(a)} × ${bn(b - b % 10)} = ${bn(a * (b - b % 10))}; ধাপ ২: ${bn(a)} × ${bn(b % 10)} = ${bn(a * (b % 10))}; ধাপ ৩: ${bn(a * (b - b % 10))} + ${bn(a * (b % 10))} = ${bn(p)}।`, pos()));
  }
  // Percentage change
  for (const old of [200, 400, 500, 800, 1000, 1250, 2000, 2500]) for (const d of [10, 20, 25, 40, 50, 100]) {
    const pct = (d / old) * 100; if (!Number.isInteger(pct)) continue;
    push(make(`কোনো জিনিসের দাম ${bn(old)} টাকা থেকে বেড়ে ${bn(old + d)} টাকা হলে শতকরা কত বৃদ্ধি পেল?`, pct, [pct + 5, pct * 2, pct + 1, d], `ধাপ ১: বৃদ্ধি = ${bn(old + d)} − ${bn(old)} = ${bn(d)} টাকা; ধাপ ২: শতকরা বৃদ্ধি = ${bn(d)} ÷ ${bn(old)} × ১০০ = ${bn(pct)}%।`, pos(), '%'));
  }
  return out.filter((q, i, all) => all.findIndex(o => o.q === q.q) === i);
}
