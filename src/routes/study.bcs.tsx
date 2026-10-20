import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import { Check, Clock3, Lightbulb, Play, RotateCcw, SkipForward, Trophy, Volume2, VolumeX, X } from 'lucide-react';
import { BackButton } from '@/components/game/back-button';
import { Button } from '@/components/ui/button';
import { computeScore, grade, makeDeck, MODE_TIME, optionLabel, SUBJECTS, type BcsQuestion, type Outcome, type QuizMode } from '@/lib/bcs-questions';
import { addRecord, emptyStats, loadStats, saveStats, type QuizStats } from '@/lib/bcs-stats';

export const Route = createFileRoute('/study/bcs')({
  head: () => ({ meta: [
    { title: 'BCS কুইজ চ্যালেঞ্জ — প্রতি প্রশ্নে ১০ সেকেন্ড' },
    { name: 'description', content: 'বিসিএস প্রিলিমিনারি প্রস্তুতির কুইজ: প্রতি প্রশ্নে ১০ সেকেন্ড, ৪টি অপশন, স্কিপ এবং শেষে বিস্তারিত ফলাফল।' },
    { property: 'og:title', content: 'BCS কুইজ চ্যালেঞ্জ' },
    { property: 'og:description', content: 'প্রতি প্রশ্নে ১০ সেকেন্ডে বিসিএস প্রস্তুতি যাচাই করুন।' },
    { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' },
  ] }),
  component: BcsQuiz,
});

const COUNTS = [{ n: 10, label: '১০টি · কুইক প্র্যাকটিস' }, { n: 20, label: '২০টি · স্ট্যান্ডার্ড রাউন্ড' }, { n: 50, label: '৫০টি · মডেল টেস্ট' }, { n: 0, label: 'আনলিমিটেড · এন্ডলেস' }];
const MODES: { id: QuizMode; label: string; desc: string }[] = [
  { id: 'quick', label: 'কুইক চ্যালেঞ্জ', desc: 'প্রতি প্রশ্নে ১০ সেকেন্ড, সব বিষয় মিশ্র' },
  { id: 'subject', label: 'বিষয়ভিত্তিক অনুশীলন', desc: 'একটি বিষয় বেছে নিয়ে অনুশীলন, প্রতি প্রশ্নে ২০ সেকেন্ড' },
  { id: 'model', label: 'পূর্ণাঙ্গ মডেল টেস্ট', desc: 'অফিশিয়াল স্টাইল, নেগেটিভ মার্কিং সহ, প্রতি প্রশ্নে ৩০ সেকেন্ড' },
];
const SEEN_KEY = 'bcs-seen-questions-v1';
function loadSeen(): Set<string> { try { const v: unknown = JSON.parse(localStorage.getItem(SEEN_KEY) ?? '[]'); return new Set(Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []); } catch { return new Set(); } }
function saveSeen(seen: Set<string>) { try { localStorage.setItem(SEEN_KEY, JSON.stringify([...seen])); } catch { /* storage unavailable */ } }
const bn = (n: number) => String(n).replace(/\d/g, d => '০১২৩৪৫৬৭৮৯'.charAt(Number(d)));

function BcsQuiz() {
  const [status, setStatus] = useState<'ready' | 'playing' | 'finished'>('ready');
  const [questions, setQuestions] = useState<BcsQuestion[]>([]);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [mode, setMode] = useState<QuizMode>('quick');
  const [subject, setSubject] = useState<string>(SUBJECTS[0]);
  const [count, setCount] = useState(20);
  const [negative, setNegative] = useState(false);
  const [muted, setMuted] = useState(false);
  const [stats, setStats] = useState<QuizStats>(emptyStats);
  const time = MODE_TIME[mode];
  const [remaining, setRemaining] = useState(time);
  const [results, setResults] = useState<Outcome[]>([]);
  const deckRef = useRef<(() => BcsQuestion) | null>(null);
  const audioRef = useRef<AudioContext | null>(null);
  const endless = count === 0;
  const lockRef = useRef(-1); // prevents the same question being answered twice (timer + click)

  useEffect(() => { setStats(loadStats()); }, []);
  const beep = (kind: 'correct' | 'wrong' | 'tick' | 'submit') => {
    if (muted) return;
    try {
      const ctx = audioRef.current ?? new AudioContext(); audioRef.current = ctx; void ctx.resume();
      // 'submit' নিরপেক্ষ শব্দ: সঠিক/ভুল উভয় উত্তরে একই রকম, ফলে শুনে বোঝা যায় না
      const freqs = kind === 'correct' ? [660, 880] : kind === 'wrong' ? [200, 140] : kind === 'submit' ? [520] : [1000];
      freqs.forEach((f, i) => { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sine'; o.frequency.value = f; const t = ctx.currentTime + i * 0.11; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(kind === 'tick' ? 0.05 : 0.08, t + 0.01); g.gain.exponentialRampToValueAtTime(0.001, t + (kind === 'tick' ? 0.08 : 0.18)); o.connect(g).connect(ctx.destination); o.start(t); o.stop(t + 0.2); });
    } catch { /* sound unavailable */ }
  };
  const pickMode = (m: QuizMode) => { setMode(m); setNegative(m === 'model'); if (m === 'model' && count === 10) setCount(50); };
  const start = () => {
    const seen = loadSeen(); const deck = makeDeck(mode === 'subject' ? subject : null, Math.random, seen, () => saveSeen(seen)); deckRef.current = deck;
    setQuestions(endless ? [deck()] : Array.from({ length: count }, deck));
    lockRef.current = -1; setIndex(0); setSelected(null); setRemaining(time); setResults([]); setStatus('playing');
  };
  const finish = (all: Outcome[]) => {
    setStatus('finished');
    const c = all.filter(r => r.status === 'correct').length, w = all.filter(r => r.status === 'wrong').length;
    const next = addRecord(loadStats(), { date: new Date().toISOString(), mode, total: all.length, correct: c, wrong: w, score: computeScore(c, w, negative) });
    saveStats(next); setStats(next);
  };
  const advance = (chosen: number | null) => {
    const q = questions[index];
    if (!q || status !== 'playing' || lockRef.current === index) return;
    lockRef.current = index;
    const out = grade(q, chosen);
    // নিরপেক্ষ সাউন্ড: সঠিক/ভুল বোঝা যাবে না, শুধু জমা হয়েছে তা জানাবে
    if (chosen !== null) beep('submit');
    const all = [...results, out];
    setResults(all);
    setSelected(null); setRemaining(time);
    if (endless) { setQuestions(prev => [...prev, deckRef.current!()]); setIndex(index + 1); return; }
    if (index + 1 >= questions.length) finish(all); else setIndex(index + 1);
  };
  const finishEarly = () => { if (!window.confirm('কুইজ এখনই শেষ করতে চান?')) return; finish(endless ? results : [...results, ...questions.slice(index).map(q => grade(q, null))]); };

  useEffect(() => {
    if (status !== 'playing') return;
    if (remaining <= 0) { advance(selected); return; }
    if (remaining <= 3) beep('tick');
    const t = window.setTimeout(() => setRemaining(r => r - 1), 1000);
    return () => window.clearTimeout(t);
  }, [status, remaining, index]);

  const correct = results.filter(r => r.status === 'correct').length;
  const wrong = results.filter(r => r.status === 'wrong').length;
  const skipped = results.filter(r => r.status === 'skipped').length;
  const attempted = correct + wrong;
  const score = computeScore(correct, wrong, negative);
  const q = questions[index];
  const reviewed = questions.slice(0, results.length);

  return <div className="bcs-colorful min-h-screen bg-background text-foreground">
    <div className="mx-auto max-w-2xl px-4 py-6">
      <div className="mb-6 flex items-center justify-between">
        <BackButton />
        <h1 className="text-xl font-bold">BCS কুইজ চ্যালেঞ্জ</h1>
        <Button variant="ghost" size="icon" onClick={() => setMuted(m => !m)} aria-label={muted ? 'সাউন্ড চালু' : 'সাউন্ড বন্ধ'}>{muted ? <VolumeX /> : <Volume2 />}</Button>
      </div>

      {status === 'ready' && <div className="rounded-2xl border bg-card p-6 text-center shadow-sm">
        <h2 className="mb-3 text-2xl font-bold">প্রস্তুত?</h2>
        <div className="mb-4 text-left">
          <p className="mb-2 text-sm font-semibold">কুইজ মোড</p>
          <div className="grid gap-2">{MODES.map(m => <button key={m.id} type="button" aria-pressed={mode === m.id} onClick={() => pickMode(m.id)} className={`rounded-xl border-2 p-3 text-left transition-colors ${mode === m.id ? 'border-primary bg-primary/10' : 'border-border hover:bg-muted'}`}><div className="font-semibold">{m.label}</div><div className="text-xs text-muted-foreground">{m.desc}</div></button>)}</div>
        </div>
        {mode === 'subject' && <div className="mb-4 text-left">
          <p className="mb-2 text-sm font-semibold">বিষয় নির্বাচন</p>
          <div className="flex flex-wrap gap-2">{SUBJECTS.map(s => <button key={s} type="button" aria-pressed={subject === s} onClick={() => setSubject(s)} className={`rounded-full border px-3 py-1 text-xs ${subject === s ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:bg-muted'}`}>{s}</button>)}</div>
        </div>}
        <div className="mb-4 text-left">
          <p className="mb-2 text-sm font-semibold">প্রশ্নের সংখ্যা</p>
          <div className="grid grid-cols-2 gap-2">{COUNTS.map(c => <button key={c.n} type="button" aria-pressed={count === c.n} onClick={() => setCount(c.n)} className={`rounded-xl border-2 p-2 text-sm ${count === c.n ? 'border-primary bg-primary/10 font-semibold' : 'border-border hover:bg-muted'}`}>{c.label}</button>)}</div>
        </div>
        <label className="mb-4 flex cursor-pointer items-center justify-between rounded-xl border p-3 text-left text-sm">
          <span><strong>নেগেটিভ মার্কিং</strong><br /><span className="text-xs text-muted-foreground">প্রতি ভুল উত্তরে ০.৫০ নম্বর কাটা যাবে</span></span>
          <input type="checkbox" className="h-5 w-5 accent-primary" checked={negative} onChange={e => setNegative(e.target.checked)} />
        </label>
        <ul className="mb-6 space-y-1 text-left text-sm text-muted-foreground">
          <li>• {endless ? 'আনলিমিটেড প্রশ্ন — "শেষ করুন" চাপলে ফলাফল দেখাবে' : `মোট ${bn(count)}টি প্রশ্ন`}, প্রতিটির জন্য {bn(time)} সেকেন্ড</li>
          <li>• অপশনে ক্লিক করে টিক দিন, আবার ক্লিক করলে বাতিল হবে</li>
          <li>• "উত্তর দিন" চাপলে জমা হবে, "স্কিপ" চাপলে পরের প্রশ্নে যাবে</li>
          <li>• সময় শেষ হলে টিক দেওয়া উত্তর জমা হবে, না দিলে স্কিপ ধরা হবে</li>
        </ul>
        <Button size="lg" onClick={start}><Play /> শুরু করুন</Button>
        {stats.played > 0 && <div className="mt-6 rounded-xl bg-muted p-4 text-left text-sm">
          <p className="mb-2 flex items-center gap-1 font-semibold"><Trophy size={16} /> আপনার পারফরম্যান্স</p>
          <div className="grid grid-cols-2 gap-2">
            <span>হাই-স্কোর: <strong>{bn(stats.highScore)}</strong></span><span>খেলা কুইজ: <strong>{bn(stats.played)}</strong></span>
            <span>মোট সঠিক: <strong>{bn(stats.totalCorrect)}</strong></span><span>মোট ভুল: <strong>{bn(stats.totalWrong)}</strong></span>
          </div>
          {stats.history.length > 0 && <ul className="mt-3 space-y-1 text-xs text-muted-foreground">{stats.history.slice(0, 5).map((h, i) => <li key={i}>{new Date(h.date).toLocaleDateString('bn-BD')} · {MODES.find(m => m.id === h.mode)?.label ?? h.mode} · {bn(h.correct)}/{bn(h.total)} সঠিক · স্কোর {bn(h.score)}</li>)}</ul>}
        </div>}
      </div>}

      {status === 'playing' && q && <div className="rounded-2xl border bg-card p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between text-sm">
          <span className="text-muted-foreground">প্রশ্ন {bn(index + 1)}{endless ? '' : ` / ${bn(questions.length)}`} · {q.subject}</span>
          <span className={`flex items-center gap-1 font-bold ${remaining <= 3 ? 'text-destructive' : ''}`}><Clock3 size={16} /> {bn(remaining)} সে.</span>
        </div>
        <div className="mb-5 h-2 overflow-hidden rounded-full bg-muted">
          <div className={`h-full transition-all duration-1000 ease-linear ${remaining <= 3 ? 'bg-destructive' : 'bg-primary'}`} style={{ width: `${(remaining / time) * 100}%` }} />
        </div>
        <h2 className="mb-5 text-lg font-semibold leading-relaxed">{q.q}</h2>
        <div className="grid gap-3">
          {q.options.map((opt, i) => <button key={i} type="button" aria-pressed={selected === i} onClick={() => setSelected(selected === i ? null : i)}
            className={`flex items-center gap-3 rounded-xl border-2 p-3 text-left transition-colors ${selected === i ? 'border-primary bg-primary/10' : 'border-border hover:bg-muted'}`}>
            <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 font-bold ${selected === i ? 'border-primary bg-primary text-primary-foreground' : 'border-border'}`}>{selected === i ? <Check size={16} /> : optionLabel(i)}</span>
            <span>{opt}</span>
          </button>)}
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          <Button className="flex-1" disabled={selected === null} onClick={() => advance(selected)}><Check /> উত্তর দিন</Button>
          <Button variant="outline" className="flex-1" onClick={() => advance(null)}><SkipForward /> স্কিপ</Button>
          <Button variant="ghost" onClick={finishEarly}>শেষ করুন</Button>
        </div>
      </div>}

      {status === 'finished' && <div className="space-y-4">
        <div className="rounded-2xl border bg-card p-6 text-center shadow-sm">
          <h2 className="mb-1 text-2xl font-bold">ফলাফল</h2>
          <p className="mb-4 text-muted-foreground">মোট প্রশ্ন {bn(results.length)}টি</p>
          <div className="mb-4 grid grid-cols-3 gap-3">
            <div className="rounded-xl bg-primary/10 p-3"><div className="text-2xl font-bold">{bn(correct)}</div><div className="text-xs">সঠিক</div></div>
            <div className="rounded-xl bg-destructive/10 p-3"><div className="text-2xl font-bold text-destructive">{bn(wrong)}</div><div className="text-xs">ভুল</div></div>
            <div className="rounded-xl bg-muted p-3"><div className="text-2xl font-bold">{bn(skipped)}</div><div className="text-xs">স্কিপ</div></div>
          </div>
          <p className="mb-1 text-lg">প্রাপ্ত নম্বর: <strong>{bn(score)}</strong>{negative && <span className="text-xs text-muted-foreground"> (নেগেটিভ মার্কিং −{bn(wrong * 0.5)})</span>}</p>
          <p className="mb-4 text-sm">নির্ভুলতা: <strong>{bn(attempted ? Math.round((correct / attempted) * 100) : 0)}%</strong></p>
          <Button onClick={start}><RotateCcw /> আবার খেলুন</Button>
        </div>
        <div className="rounded-2xl border bg-card p-4 shadow-sm">
          <h3 className="mb-3 font-semibold">উত্তর পর্যালোচনা</h3>
          <ol className="space-y-3">
            {reviewed.map((item, i) => { const r = results[i]; return <li key={i} className="border-b pb-3 text-sm last:border-0">
              <p className="mb-1 font-medium">{bn(i + 1)}. {item.q}</p>
              <p className="flex items-center gap-1 text-primary"><Check size={14} /> সঠিক: {optionLabel(item.answer)}) {item.options[item.answer]}</p>
              {r?.status === 'wrong' && r.chosen !== null && <p className="flex items-center gap-1 text-destructive"><X size={14} /> আপনার উত্তর: {optionLabel(r.chosen)}) {item.options[r.chosen]}</p>}
              {r?.status === 'skipped' && <p className="text-muted-foreground">স্কিপ করা হয়েছে</p>}
              {item.explain && <p className="mt-1 flex gap-1 rounded-lg bg-muted p-2 text-muted-foreground"><Lightbulb size={14} className="mt-0.5 shrink-0" /> {item.explain}</p>}
            </li>; })}
          </ol>
        </div>
      </div>}
    </div>
  </div>;
}
