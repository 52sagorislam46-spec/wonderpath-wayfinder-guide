import { createFileRoute } from '@tanstack/react-router';
import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { ArrowRight, ChevronDown, Clock3, Flag, History, Keyboard, Medal, Pause, Play, RotateCcw, Settings2, Sparkles, Swords, Trophy, User, Users, Volume2, VolumeX } from 'lucide-react';
import { BackButton } from '@/components/game/back-button';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Arena } from '@/components/game/arena';
import { PlayerPanel } from '@/components/game/player-panel';
import { formatTime, matchReducer, newMatch, PULL_TARGET, type Difficulty, type Operation, type RecordMatch, type Settings } from '@/lib/game';

export const Route = createFileRoute('/study/math')({
  head: () => ({ meta: [
    { title: 'Tug of Math — Fly Arena' },
    { name: 'description', content: 'A friendly two-player mathematics showdown. Pick your challenge, race to solve, and pull your team to victory.' },
    { property: 'og:title', content: 'Tug of Math — Fly Arena' },
    { property: 'og:description', content: 'Two teams. One rope. A classroom-ready mathematics showdown with live pulls and local match results.' },
    { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary_large_image' },
  ] }),
  component: MathGame,
});
const initialSettings: Settings = { duration: 60, operation: 'multiplication', difficulty: 'easy', mode: 'duo' };
const operationNames: Record<Operation, string> = { addition: 'Addition', subtraction: 'Subtraction', multiplication: 'Multiplication', division: 'Division', mixed: 'Mixed' };
const historyKey = 'tug-of-math-history-v1';
function isRecord(value: unknown): value is RecordMatch {
  if (!value || typeof value !== 'object') return false;
  const v = value as Partial<RecordMatch>;
  return typeof v.id === 'string' && typeof v.date === 'string' && (v.winner === null || v.winner === 0 || v.winner === 1) && Array.isArray(v.scores) && v.scores.length === 2 && v.scores.every(n => typeof n === 'number' && n >= 0) && Array.isArray(v.attempts) && v.attempts.length === 2 && v.attempts.every(n => typeof n === 'number' && n >= 0) && typeof v.elapsed === 'number' && v.elapsed >= 0 && typeof v.operation === 'string' && v.operation in operationNames && ['easy', 'medium', 'hard'].includes(v.difficulty ?? '') && (v.mode === undefined || v.mode === 'solo' || v.mode === 'duo');
}
function MathGame() {
  const [settings, setSettings] = useState<Settings>(initialSettings);
  const [names, setNames] = useState<[string, string]>(['', '']);
  const setName = (team: 0 | 1, value: string) => setNames(prev => team === 0 ? [value, prev[1]] : [prev[0], value]);
  const [match, dispatch] = useReducer(matchReducer, initialSettings, (value) => newMatch(value, true));
  const [muted, setMuted] = useState(false);
  const [history, setHistory] = useState<RecordMatch[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyView, setHistoryView] = useState<'matches' | 'leaderboard'>('matches');
  const [helpOpen, setHelpOpen] = useState(false);
  const [resultOpen, setResultOpen] = useState(false);
  const [restartOpen, setRestartOpen] = useState(false);
  const [customTime, setCustomTime] = useState(false);
  const [customValue, setCustomValue] = useState('90');
  const [storageError, setStorageError] = useState(false);
  const audioRef = useRef<AudioContext | null>(null);
  const savedRef = useRef('');
  const playing = match.status === 'playing';
  const locked = ['playing', 'paused', 'countdown'].includes(match.status);
  const difference = match.players[0].score - match.players[1].score;
  const solo = settings.mode === 'solo';
  const playSound = useCallback((kind: 'correct' | 'wrong' | 'whistle' | 'victory' | 'pull') => {
    if (muted) return;
    try {
      const audio = audioRef.current ?? new AudioContext(); audioRef.current = audio;
      void audio.resume();
      const frequencies = kind === 'victory' ? [523, 659, 784, 1047, 784, 1047] : kind === 'correct' ? [660, 880] : kind === 'wrong' ? [160, 120] : kind === 'pull' ? [220, 260] : [1100, 1400];
      frequencies.forEach((frequency, i) => {
        const oscillator = audio.createOscillator(), gain = audio.createGain();
        oscillator.type = kind === 'wrong' ? 'sawtooth' : 'sine'; oscillator.frequency.value = frequency;
        const start = audio.currentTime + i * 0.115;
        gain.gain.setValueAtTime(0, start); gain.gain.linearRampToValueAtTime(kind === 'pull' ? 0.035 : 0.09, start + 0.012); gain.gain.exponentialRampToValueAtTime(0.001, start + 0.2);
        oscillator.connect(gain); gain.connect(audio.destination); oscillator.start(start); oscillator.stop(start + 0.22);
      });
    } catch { /* Audio is optional when unavailable. */ }
  }, [muted]);
  useEffect(() => {
    try { const raw = localStorage.getItem(historyKey); if (raw) { const parsed: unknown = JSON.parse(raw); if (Array.isArray(parsed)) setHistory(parsed.filter(isRecord).slice(0, 50)); } setMuted(localStorage.getItem('tug-of-math-muted') === 'true'); } catch { setStorageError(true); }
    return () => { void audioRef.current?.close(); };
  }, []);
  useEffect(() => {
    if (match.status !== 'playing' && match.status !== 'countdown') return;
    const timer = window.setInterval(() => dispatch({ type: 'tick' }), 1000);
    return () => window.clearInterval(timer);
  }, [match.status]);
  useEffect(() => { if (match.status === 'countdown' || (playing && match.remaining <= 5)) playSound('whistle'); }, [match.countdown, match.status, match.remaining, playing, playSound]);
  useEffect(() => {
    if (match.status !== 'finished' || savedRef.current === match.id) return;
    savedRef.current = match.id;
    const record: RecordMatch = { id: match.id, date: new Date().toISOString(), winner: match.winner, scores: [match.players[0].score, match.players[1].score], attempts: [match.players[0].attempts, match.players[1].attempts], elapsed: match.elapsed, operation: settings.operation, difficulty: settings.difficulty, mode: settings.mode, names: [names[0].trim(), names[1].trim()] };
    const next = [record, ...history].slice(0, 50);
    setHistory(next); setResultOpen(true); playSound('victory');
    try { localStorage.setItem(historyKey, JSON.stringify(next)); } catch { setStorageError(true); }
  }, [match, settings, history, playSound, names]);
  useEffect(() => {
    const timers = match.players.map((player, team) => player.feedback ? window.setTimeout(() => dispatch({ type: 'clearFeedback', team: team as 0 | 1 }), 700) : undefined);
    return () => timers.forEach(timer => { if (timer !== undefined) clearTimeout(timer); });
  }, [match.players]);
  const inputKey = useCallback((team: 0 | 1, key: string) => {
    if (!playing) return;
    const player = match.players[team];
    if (key === 'enter' && player.input) {
      const correct = Number(player.input) === player.problem.answer;
      playSound(correct ? 'correct' : 'wrong');
      if (correct) setTimeout(() => playSound('pull'), 120);
    }
    dispatch({ type: 'input', team, key, settings });
  }, [match.players, playing, settings, playSound]);
  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      if (helpOpen || historyOpen || restartOpen || resultOpen || (event.target instanceof HTMLElement && ['INPUT', 'SELECT', 'TEXTAREA'].includes(event.target.tagName))) return;
      if (event.repeat) return;
      const leftMap: Record<string, string> = { q: '1', w: '2', e: '3', a: '4', s: '5', d: '6', z: '7', x: '8', c: '9', v: '0', r: 'backspace', f: 'enter' };
      const mappedKey = leftMap[event.key.toLowerCase()];
      if (mappedKey) { event.preventDefault(); inputKey(0, mappedKey); }
      else if (/^\d$/.test(event.key) || ['Backspace', 'Enter', 'Delete'].includes(event.key)) { event.preventDefault(); inputKey(solo ? 0 : 1, event.key === 'Backspace' ? 'backspace' : event.key === 'Enter' ? 'enter' : event.key === 'Delete' ? 'clear' : event.key); }
      else if (event.code === 'Space' && locked && match.status !== 'countdown') { event.preventDefault(); dispatch({ type: 'pause' }); }
    };
    window.addEventListener('keydown', listener); return () => window.removeEventListener('keydown', listener);
  }, [inputKey, helpOpen, historyOpen, restartOpen, resultOpen, locked, match.status, solo]);
  const updateSettings = (update: Partial<Settings>) => { const next = { ...settings, ...update }; setSettings(next); dispatch({ type: 'reset', settings: next }); };
  const startMatch = () => { setResultOpen(false); dispatch({ type: 'reset', settings }); dispatch({ type: 'start' }); playSound('whistle'); };
  const toggleMute = () => { setMuted(!muted); try { localStorage.setItem('tug-of-math-muted', String(!muted)); } catch { /* Sound preference still applies. */ } };
  const openHelp = () => { if (playing) dispatch({ type: 'pause' }); setHelpOpen(true); };
  const openHistory = () => { if (playing) dispatch({ type: 'pause' }); setHistoryOpen(true); };
  function teamName(t: number) { return names[t]?.trim() || `Team ${t + 1}`; }
  const winnerText = solo ? (match.winner === null ? "Time's up!" : 'You win!') : match.winner === null ? "It's a tie!" : `${teamName(match.winner)} wins!`;
  const wins: [number, number] = [history.filter(record => record.winner === 0).length, history.filter(record => record.winner === 1).length];
  return <div className={`app-shell ${locked ? 'match-is-active' : ''}`}>
    <header className="site-header"><div className="header-inner">
      <a href="/" className="brand" aria-label="Tug of Math home"><span className="brand-mark"><Swords size={23} /></span><span>Tug of<span className="brand-math"> Math</span><span className="brand-dot">.</span></span></a>
      <span className="classroom-badge"><span /> CLASSROOM EDITION</span>
      <div className="header-actions"><BackButton /><Button variant="ghost" onClick={openHistory} className="history-button"><History /><span>Match history</span></Button><span className="header-divider" /><Button variant="ghost" size="icon" onClick={toggleMute} aria-label={muted ? 'Enable sound' : 'Mute sound'} title={muted ? 'Enable sound' : 'Mute sound'}>{muted ? <VolumeX /> : <Volume2 />}</Button><Button variant="ghost" size="icon" onClick={openHelp} aria-label="Keyboard controls and game rules" title="Keyboard controls & rules"><Keyboard /></Button></div>
    </div></header>
    <main className="main-content">
      <section className="page-heading"><div className="heading-eyebrow"><span className="eyebrow-line" /><Swords size={14} /> THE ULTIMATE BRAIN BATTLE <span className="eyebrow-line" /></div><h1>Tug of War<span className="title-colon">:</span> <span>Mathematics</span></h1><p>A little brainpower. A lot of team spirit.</p></section>
      <section className="settings-bar" aria-label="Match settings">
        <div className="settings-label"><Settings2 size={18} /><span>Match settings</span></div>
        <div className="setting-item timer-setting"><label><Clock3 size={16} /> DURATION</label><div className="duration-options">{[30, 60, 120].map(duration => <Button key={duration} variant="ghost" disabled={locked} aria-pressed={!customTime && settings.duration === duration} className={!customTime && settings.duration === duration ? 'setting-active' : ''} onClick={() => { setCustomTime(false); updateSettings({ duration }); }}>{duration === 30 ? '30 sec' : `${duration / 60} min`}</Button>)}<Button variant="ghost" disabled={locked} aria-pressed={customTime} className={customTime ? 'setting-active' : ''} onClick={() => { setCustomTime(true); updateSettings({ duration: Number(customValue) || 90 }); }}>Custom</Button></div>{customTime && <div className="custom-duration"><Input aria-label="Custom duration in seconds" type="number" min="10" max="600" disabled={locked} value={customValue} onChange={e => setCustomValue(e.target.value)} onBlur={() => { const duration = Math.min(600, Math.max(10, Math.round(Number(customValue) || 90))); setCustomValue(String(duration)); updateSettings({ duration }); }} /><span>seconds</span></div>}</div>
        <div className="setting-item"><label htmlFor="operation">OPERATION</label><div className="select-wrapper"><span className="operation-symbol">{settings.operation === 'multiplication' ? '×' : settings.operation === 'addition' ? '+' : settings.operation === 'subtraction' ? '−' : settings.operation === 'division' ? '÷' : '±'}</span><select id="operation" disabled={locked} value={settings.operation} onChange={e => updateSettings({ operation: e.target.value as Operation })}>{Object.entries(operationNames).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><ChevronDown size={15} /></div></div>
        <div className="setting-item"><label htmlFor="difficulty">DIFFICULTY</label><div className="select-wrapper"><span className={`difficulty-bars ${settings.difficulty}`}><i /><i /><i /></span><select id="difficulty" disabled={locked} value={settings.difficulty} onChange={e => updateSettings({ difficulty: e.target.value as Difficulty })}><option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option></select><ChevronDown size={15} /></div></div>
        <div className="setting-item players-setting"><label>PLAYERS</label><div className="duration-options"><Button variant="ghost" disabled={locked} aria-pressed={!solo} className={!solo ? 'setting-active' : ''} onClick={() => updateSettings({ mode: 'duo' })}><Users size={13} />2 players</Button><Button variant="ghost" disabled={locked} aria-pressed={solo} className={solo ? 'setting-active' : ''} onClick={() => updateSettings({ mode: 'solo' })}><User size={13} />1 player</Button></div></div>
      </section>
      <div className={`game-layout ${solo ? 'solo-mode' : ''}`}>
        <PlayerPanel team={0} player={match.players[0]} disabled={!playing} onKey={key => inputKey(0, key)} name={names[0]} onNameChange={value => setName(0, value)} nameLocked={locked} />
        <section className="center-stage" aria-label="Live match arena">
          <div className="arena-scoreboard"><div className="scoreboard-team blue"><span className="scoreboard-dot" />TEAM 1<strong>{match.players[0].score}</strong></div><div className="match-actions scoreboard-actions">{match.status === 'ready' || match.status === 'finished' ? <Button className="start-button" onClick={startMatch}><Play size={18} fill="currentColor" />{match.status === 'finished' ? 'Play again' : 'Start match'}<ArrowRight size={18} /></Button> : <Button className="start-button pause-button" disabled={match.status === 'countdown'} onClick={() => dispatch({ type: 'pause' })}>{match.status === 'paused' ? <Play /> : <Pause />}{match.status === 'paused' ? 'Resume match' : 'Pause match'}</Button>}<Button className="reset-button" variant="outline" size="icon" aria-label="Reset match" title="Reset match" onClick={() => locked ? setRestartOpen(true) : dispatch({ type: 'reset', settings })}><RotateCcw /></Button></div>{solo ? <div className="scoreboard-team goal"><span className="scoreboard-dot" />ANSWERED<strong>{match.players[0].attempts}</strong></div> : <div className="scoreboard-team red"><span className="scoreboard-dot" />TEAM 2<strong>{match.players[1].score}</strong></div>}</div>
          <div className="arena-space"><div className="arena-state"><span className={playing ? 'live-dot' : 'status-dot'} />{match.status === 'ready' ? 'THE ARENA IS READY' : match.status === 'countdown' ? 'GET READY TO PULL' : match.status === 'paused' ? 'TAKE A BREATHER' : match.status === 'finished' ? 'WHAT A MATCH!' : 'MATCH IN PROGRESS'}</div><Arena match={match} solo={solo} />
            {match.status === 'countdown' && <div className="countdown-overlay"><strong key={match.countdown}>{match.countdown}</strong></div>}
            {match.status === 'paused' && <div className="paused-overlay"><Pause size={30} /><strong>Match paused</strong><Button onClick={() => dispatch({ type: 'pause' })}><Play size={16} fill="currentColor" /> Resume</Button></div>}
          </div>
          <div className="tug-meter"><div className="meter-labels"><span>{solo ? 'YOU' : 'TEAM 1'}</span><span>{solo ? (match.players[0].score === 0 ? 'Pull with your first answer' : 'Keep going — every answer counts') : (difference === 0 ? 'Evenly matched' : `Team ${difference > 0 ? 1 : 2} is pulling ahead`)}</span><span>{solo ? 'NO LIMIT' : 'TEAM 2'}</span></div><div className="meter-track"><div className="meter-blue" /><div className="meter-red" /><div className="meter-center" /><span className="meter-marker" style={{ left: `${50 - difference * 5.5}%` }}><Flag size={12} fill="currentColor" /></span></div></div>
          <div className="clock-below"><div className={`match-clock ${match.remaining <= 10 && playing ? 'clock-urgent' : ''}`}><span><Clock3 size={14} />{match.status === 'playing' ? 'TIME LEFT' : match.status === 'paused' ? 'PAUSED' : match.status === 'finished' ? 'FULL TIME' : 'MATCH TIMER'}</span><strong>{formatTime(match.remaining)}</strong></div></div>
          <div className="match-caption"><span className="caption-dot" />{match.status === 'ready' ? (solo ? 'One player. One rope. Pull with everything you have.' : 'Two teams. One rope. Let’s do this.') : match.status === 'finished' ? winnerText : match.status === 'paused' ? 'The rope can wait. Your match is safe.' : `${operationNames[settings.operation]} · ${settings.difficulty} · ${solo ? 'Answer as many as you can before time runs out' : 'First to an 8-point lead wins'}`}</div>
        </section>
        {!solo && <PlayerPanel team={1} player={match.players[1]} disabled={!playing} onKey={key => inputKey(1, key)} name={names[1]} onNameChange={value => setName(1, value)} nameLocked={locked} />}
      </div>
      <section className="match-bottom"><div className="bottom-label"><Trophy size={19} /><div><strong>A little friendly competition</strong><span>{history.length ? `${history.length} ${history.length === 1 ? 'match' : 'matches'} played · ${wins[0] + wins[1]} victories earned` : 'A fresh start. An even playing field.'}</span></div></div><div className="team-win-summary">{solo ? <span><i className="blue-dot" /> Solo wins <strong>{history.filter(r => r.mode === 'solo' && r.winner === 0).length}</strong></span> : <><span><i className="blue-dot" /> Team 1 <strong>{wins[0]}</strong></span><span className="versus">VS</span><span><i className="red-dot" /> Team 2 <strong>{wins[1]}</strong></span></>}<Button variant="ghost" size="icon" onClick={openHistory} aria-label="Open leaderboard" title="Leaderboard"><ArrowRight /></Button></div></section>
      <footer className="page-footer"><span><Sparkles size={14} /> Big thinking. Bigger smiles.</span><span>Made for a little healthy rivalry.</span></footer>
    </main>
    <Dialog open={helpOpen} onOpenChange={setHelpOpen}><DialogContent className="game-dialog"><DialogHeader><DialogTitle>Ready, set, pull!</DialogTitle><DialogDescription>Every correct answer earns one point and pulls the rope. An 8-point lead wins instantly. Otherwise, the team ahead when time runs out wins.</DialogDescription></DialogHeader><div className="keyboard-help"><section className="blue"><h3>Team 1 · Letter keys</h3><div className="help-key-grid">{['Q 1','W 2','E 3','A 4','S 5','D 6','Z 7','X 8','C 9','R ⌫','V 0','F ↵'].map(k => <kbd key={k}>{k}</kbd>)}</div></section><section className="red"><h3>Team 2 · Number keys</h3><p>Use 0–9 on the number row or numeric keypad.</p><p><kbd>Enter</kbd> submit<br /><kbd>Backspace</kbd> delete<br /><kbd>Delete</kbd> clear</p></section></div>{solo ? <p className="help-note">Solo mode: no goal limit — the match runs until time runs out. Answer as many as you can. Use the letter keys, the number keys, or the on-screen keypad.</p> : <p className="help-note">Space pauses or resumes the match. Both players can always use the on-screen keypads.</p>}<div className="difficulty-help"><strong>Number ranges</strong><p>Easy: +/− up to 20, ×/÷ factors 2–10.<br />Medium: +/− up to 50, ×/÷ factors 2–12.<br />Hard: +/− up to 150, ×/÷ factors 2–20.</p><p>Division always has a whole-number answer; subtraction never goes below zero.</p></div></DialogContent></Dialog>
    <Dialog open={historyOpen} onOpenChange={setHistoryOpen}><DialogContent className="game-dialog history-dialog"><DialogHeader><DialogTitle><History size={22} /> Match history</DialogTitle><DialogDescription>Your last 50 matches, saved on this device.</DialogDescription></DialogHeader><div className="history-tabs"><Button variant="ghost" className={historyView === 'matches' ? 'setting-active' : ''} onClick={() => setHistoryView('matches')}>Recent matches</Button><Button variant="ghost" className={historyView === 'leaderboard' ? 'setting-active' : ''} onClick={() => setHistoryView('leaderboard')}>Leaderboard</Button></div>{storageError && <p className="storage-warning">This browser isn’t allowing saved results. Matches are available until you close this page.</p>}{historyView === 'leaderboard' ? <div className="leaderboard">{([0, 1] as const).slice().sort((a, b) => wins[b] - wins[a]).map((team, rank) => <div className={`leaderboard-row ${team === 0 ? 'blue' : 'red'}`} key={team}><Medal /><strong>#{rank + 1} Team {team + 1}</strong><span>{wins[team]} wins</span><span>{history.reduce((sum, r) => sum + (r.scores[team] ?? 0), 0)} solved</span></div>)}</div> : history.length ? <div className="history-list">{history.map(record => <div className="history-row" key={record.id}><span className={`history-trophy ${record.winner === 0 ? 'blue' : record.winner === 1 ? 'red' : ''}`}><Trophy size={18} /></span><div><strong>{record.winner === null ? 'An even match' : record.mode === 'solo' ? 'Solo victory' : `${record.names?.[record.winner] || `Team ${record.winner + 1}`} victory`}</strong><span>{operationNames[record.operation]} · {record.difficulty} · {new Date(record.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span></div><strong className="history-score">{record.scores[0]} <span>:</span> {record.scores[1]}</strong></div>)}</div> : <div className="history-empty"><Trophy size={38} /><strong>The first trophy is up for grabs.</strong><p>Finish a match to start your story.</p></div>}{history.length > 0 && <Button variant="ghost" className="clear-history" onClick={() => { setHistory([]); try { localStorage.removeItem(historyKey); } catch { setStorageError(true); } }}>Clear match history</Button>}</DialogContent></Dialog>
    <Dialog open={resultOpen} onOpenChange={setResultOpen}><DialogContent className={`game-dialog result-dialog ${match.winner === 1 ? 'red' : 'blue'}`}><div className="confetti" aria-hidden="true">{Array.from({ length: 28 }, (_, i) => <i key={i} style={{ left: `${(i * 37) % 100}%`, animationDelay: `${i * 0.035}s`, transform: `rotate(${i * 27}deg)` }} />)}</div><div className="victory-icon"><Trophy size={40} /></div><DialogHeader><DialogTitle>{winnerText}</DialogTitle><DialogDescription>{match.winner === null ? (solo ? 'Time ran out. Pull again and beat your score.' : 'Equal brainpower. An incredible battle.') : match.reason === 'pull' ? 'An unstoppable pull! The rope is yours.' : 'Time’s up. Your brainpower took the win.'}</DialogDescription></DialogHeader><div className="final-score">{solo ? <span className="blue">{match.players[0].score}<small>{names[0] || 'YOU'}</small></span> : <><span className="blue">{match.players[0].score}<small>{names[0].trim() || 'TEAM 1'}</small></span><span>:</span><span className="red">{match.players[1].score}<small>{names[1].trim() || 'TEAM 2'}</small></span></>}</div><div className="result-stats"><div className="stat-header"><span>{formatTime(match.elapsed)} played</span><strong className="blue">{solo ? (names[0] || 'You') : teamName(0)}</strong>{!solo && <strong className="red">{teamName(1)}</strong>}</div>{['Solved', 'Accuracy', 'Avg. solve time'].map((label, i) => <div key={label}><span>{label}</span>{match.players.map((player, team) => solo && team === 1 ? null : <strong key={team}>{i === 0 ? player.score : i === 1 ? `${player.attempts ? Math.round(player.score / player.attempts * 100) : 0}%` : player.score ? `${(Math.max(1, match.elapsed) / player.score).toFixed(1)}s` : '—'}</strong>)}</div>)}</div><Button className="start-button" onClick={startMatch}><RotateCcw /> Rematch <ArrowRight /></Button>{storageError && <p className="storage-warning">This result could not be saved on your device.</p>}</DialogContent></Dialog>
    <Dialog open={restartOpen} onOpenChange={setRestartOpen}><DialogContent className="game-dialog"><DialogHeader><DialogTitle>Reset this match?</DialogTitle><DialogDescription>The current scores will be cleared. Unfinished matches aren’t saved.</DialogDescription></DialogHeader><div className="restart-actions"><Button variant="outline" onClick={() => setRestartOpen(false)}>Keep playing</Button><Button onClick={() => { setRestartOpen(false); dispatch({ type: 'reset', settings }); }}><RotateCcw />Reset match</Button></div></DialogContent></Dialog>
  </div>;
}
