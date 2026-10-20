import { Check, Delete, RotateCcw, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { Player } from '@/lib/game';
export function PlayerPanel({ team, player, disabled, onKey, name, onNameChange, nameLocked }: { team: 0 | 1; player: Player; disabled: boolean; onKey: (key: string) => void; name: string; onNameChange: (value: string) => void; nameLocked: boolean }) {
  return <section className={`player-panel team-${team} ${player.feedback === 'wrong' ? 'answer-shake' : ''}`} aria-label={`Team ${team + 1} controls`}>
    <div className="player-score"><span><span className="score-dot" /> Correct answers</span><strong>{player.score}</strong><Button size="icon" variant="ghost" disabled={disabled || !player.input} onClick={() => onKey('clear')} aria-label={`Clear Team ${team + 1} answer`} title="Clear answer"><RotateCcw /></Button></div>
    <div className="player-name"><Input aria-label={`Team ${team + 1} player name`} placeholder={`Player name (Team ${team + 1})`} maxLength={20} disabled={nameLocked} value={name} onChange={e => onNameChange(e.target.value)} /></div>
    <div className="player-content">
      <div className="problem-label">YOUR CHALLENGE</div>
      <div className="math-problem" aria-label={`Team ${team + 1} problem`}>{player.problem.a} <span>{player.problem.symbol}</span> {player.problem.b} <span>=</span> ?</div>
      <div className={`answer-display ${player.feedback ? `feedback-${player.feedback}` : ''}`} aria-live="polite"><span>{player.feedback === 'correct' ? 'Nice pull!' : player.feedback === 'wrong' ? 'Try again!' : player.input || '0'}</span><span className="answer-cursor" /></div>
      <div className="numeric-keypad">{['1','2','3','4','5','6','7','8','9','backspace','0','enter'].map(key => <Button key={key} variant="ghost" disabled={disabled} onPointerDown={e => { if (disabled) return; e.preventDefault(); e.currentTarget.releasePointerCapture?.(e.pointerId); onKey(key); }} onClick={e => { if (e.detail === 0) onKey(key); }} className={`number-key ${key === 'enter' ? 'enter-key' : key === 'backspace' ? 'delete-key' : ''}`} aria-label={`Team ${team + 1} ${key}`} title={key === 'backspace' ? 'Backspace' : key === 'enter' ? 'Submit answer' : undefined}>{key === 'enter' ? <Check /> : key === 'backspace' ? <Delete /> : key}</Button>)}</div>
    </div>
    <div className="team-heading"><span className="team-icon"><Zap size={21} fill="currentColor" /></span><h2>Team {team + 1}</h2><span className="team-label">{team === 0 ? 'BLUE' : 'RED'}</span></div>
  </section>;
}
