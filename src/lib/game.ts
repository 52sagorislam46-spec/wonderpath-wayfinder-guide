export type Operation = 'addition' | 'subtraction' | 'multiplication' | 'division' | 'mixed';
export type Difficulty = 'easy' | 'medium' | 'hard';
export type Problem = { a: number; b: number; symbol: string; answer: number };
export type Mode = 'solo' | 'duo';
export type Settings = { duration: number; operation: Operation; difficulty: Difficulty; mode: Mode };
export const PULL_TARGET = 8;
export type Player = { score: number; attempts: number; input: string; problem: Problem; feedback: 'correct' | 'wrong' | null };
export type Match = { id: string; status: 'ready' | 'countdown' | 'playing' | 'paused' | 'finished'; remaining: number; countdown: number; players: [Player, Player]; winner: number | null; elapsed: number; reason: 'time' | 'pull' };
export type RecordMatch = { id: string; date: string; winner: number | null; scores: [number, number]; attempts: [number, number]; elapsed: number; operation: Operation; difficulty: Difficulty; mode?: Mode; names?: [string, string] };
const integer = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
export function makeProblem(operation: Operation, difficulty: Difficulty): Problem {
  const op = operation === 'mixed' ? (['addition', 'subtraction', 'multiplication', 'division'] as const)[integer(0, 3)] : operation;
  const max = difficulty === 'easy' ? 10 : difficulty === 'medium' ? 12 : 20;
  let a = integer(2, max), b = integer(2, max);
  if (op === 'addition' || op === 'subtraction') { const range = difficulty === 'easy' ? 20 : difficulty === 'medium' ? 50 : 150; a = integer(1, range); b = integer(1, range); }
  if (op === 'subtraction') return { a: Math.max(a, b), b: Math.min(a, b), symbol: '−', answer: Math.abs(a - b) };
  if (op === 'division') return { a: a * b, b, symbol: '÷', answer: a };
  return { a, b, symbol: op === 'addition' ? '+' : '×', answer: op === 'addition' ? a + b : a * b };
}
export function newMatch(settings: Settings, preview = false): Match {
  let team = 0;
  const player = (): Player => ({ score: 0, attempts: 0, input: '', problem: preview ? (team++ === 0 ? { a: 9, b: 6, symbol: '×', answer: 54 } : { a: 10, b: 4, symbol: '×', answer: 40 }) : makeProblem(settings.operation, settings.difficulty), feedback: null });
  return { id: '', status: 'ready', remaining: settings.duration, countdown: 3, players: [player(), player()], winner: null, elapsed: 0, reason: 'time' };
}
export type Action = { type: 'reset'; settings: Settings } | { type: 'start' } | { type: 'tick' } | { type: 'pause' } | { type: 'input'; team: 0 | 1; key: string; settings: Settings } | { type: 'clearFeedback'; team: 0 | 1 };
export function matchReducer(state: Match, action: Action): Match {
  if (action.type === 'reset') return newMatch(action.settings);
  if (action.type === 'start') return { ...state, id: crypto.randomUUID(), status: 'countdown' };
  if (action.type === 'pause') return { ...state, status: state.status === 'paused' ? 'playing' : state.status === 'playing' ? 'paused' : state.status };
  if (action.type === 'clearFeedback') { const players: [Player, Player] = [...state.players]; players[action.team] = { ...players[action.team], feedback: null }; return { ...state, players }; }
  if (action.type === 'tick') {
    if (state.status === 'countdown') return { ...state, countdown: state.countdown - 1, status: state.countdown <= 1 ? 'playing' : 'countdown' };
    if (state.status !== 'playing') return state;
    const remaining = Math.max(0, state.remaining - 1);
    const difference = state.players[0].score - state.players[1].score;
    return { ...state, remaining, elapsed: state.elapsed + 1, status: remaining === 0 ? 'finished' : 'playing', winner: remaining === 0 ? difference === 0 ? null : difference > 0 ? 0 : 1 : null };
  }
  if (state.status !== 'playing') return state;
  const players: [Player, Player] = [...state.players];
  let player = { ...players[action.team] };
  if (action.key === 'backspace') player.input = player.input.slice(0, -1);
  else if (action.key === 'clear') player.input = '';
  else if (action.key === 'enter') {
    if (!player.input) return state;
    const correct = Number(player.input) === player.problem.answer;
    player = { ...player, attempts: player.attempts + 1, score: player.score + (correct ? 1 : 0), feedback: correct ? 'correct' : 'wrong', input: '', problem: correct ? makeProblem(action.settings.operation, action.settings.difficulty) : player.problem };
  } else if (/^\d$/.test(action.key) && player.input.length < 5) player.input += action.key;
  players[action.team] = player;
  const difference = players[0].score - players[1].score;
  const pulled = action.settings.mode !== 'solo' && Math.abs(difference) >= PULL_TARGET;
  return { ...state, players, status: pulled ? 'finished' : state.status, winner: pulled ? difference > 0 ? 0 : 1 : null, reason: pulled ? 'pull' : state.reason };
}
export const formatTime = (seconds: number) => `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
