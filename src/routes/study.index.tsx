import { createFileRoute, Link } from '@tanstack/react-router';
import { BookOpenCheck, Swords } from 'lucide-react';

export const Route = createFileRoute('/study/')({
  head: () => ({ meta: [
    { title: 'Fly Arena — অংক ও BCS কুইজ গেম' },
    { name: 'description', content: 'দুটি গেম এক জায়গায়: Tug of Math অংকের লড়াই এবং ১০ সেকেন্ডের BCS কুইজ চ্যালেঞ্জ।' },
    { property: 'og:title', content: 'Fly Arena — অংক ও BCS কুইজ গেম' },
    { property: 'og:description', content: 'অংকের টাগ-অফ-ওয়ার আর বিসিএস প্রস্তুতির কুইজ — একটি বেছে নিন।' },
    { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' },
  ] }),
  component: Home,
});

function Home() {
  const cards = [
    { to: '/study/math' as const, icon: Swords, title: 'Tug of Math', sub: 'অংকের খেলা', desc: '১ বা ২ প্লেয়ার — দ্রুত অংক করে দড়ি টানুন।', accent: 'var(--team-blue)', soft: 'var(--team-blue-soft)' },
    { to: '/study/bcs' as const, icon: BookOpenCheck, title: 'BCS কুইজ', sub: 'বিসিএস প্রস্তুতি', desc: 'প্রতি প্রশ্নে ১০ সেকেন্ড, ৪টি অপশন, শেষে ফলাফল।', accent: 'var(--team-red)', soft: 'var(--team-red-soft)' },
  ];
  return <main className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-10 text-foreground">
    <p className="mb-3 text-center text-sm font-extrabold uppercase tracking-[0.3em] text-primary">Fly Arena</p>
    <h1 className="mb-2 text-center text-3xl font-bold">কোন খেলাটি খেলবেন?</h1>
    <p className="mb-8 text-center text-muted-foreground">একটি বক্সে ক্লিক করুন</p>
    <div className="grid w-full max-w-3xl gap-5 sm:grid-cols-2">
      {cards.map(({ to, icon: Icon, title, sub, desc, accent, soft }) => <Link key={to} to={to} className="group rounded-2xl border-2 bg-card p-6 shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg" style={{ borderColor: `color-mix(in oklch, ${accent} 35%, transparent)` }}>
        <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl shadow-md" style={{ background: `linear-gradient(135deg, ${accent}, color-mix(in oklch, ${accent} 70%, var(--gold)))`, color: 'var(--primary-foreground)' }}><Icon size={28} /></span>
        <h2 className="text-2xl font-bold" style={{ color: accent }}>{title}</h2>
        <p className="mb-2 inline-block rounded-full px-3 py-0.5 text-sm font-medium" style={{ background: soft, color: accent }}>{sub}</p>
        <p className="text-sm">{desc}</p>
      </Link>)}
    </div>
  </main>;
}
