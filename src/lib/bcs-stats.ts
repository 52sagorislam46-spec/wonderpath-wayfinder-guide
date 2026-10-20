export type QuizRecord = { date: string; mode: string; total: number; correct: number; wrong: number; score: number };
export type QuizStats = { highScore: number; totalCorrect: number; totalWrong: number; played: number; history: QuizRecord[] };
const KEY = 'bcs-quiz-stats-v1';
export const emptyStats = (): QuizStats => ({ highScore: 0, totalCorrect: 0, totalWrong: 0, played: 0, history: [] });

export function loadStats(): QuizStats {
  try { const raw = localStorage.getItem(KEY); if (!raw) return emptyStats(); const s = JSON.parse(raw) as QuizStats; return { ...emptyStats(), ...s, history: Array.isArray(s.history) ? s.history : [] }; } catch { return emptyStats(); }
}
export function addRecord(stats: QuizStats, r: QuizRecord): QuizStats {
  return { highScore: Math.max(stats.highScore, r.score), totalCorrect: stats.totalCorrect + r.correct, totalWrong: stats.totalWrong + r.wrong, played: stats.played + 1, history: [r, ...stats.history].slice(0, 10) };
}
export function saveStats(s: QuizStats) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* ignore */ } }
