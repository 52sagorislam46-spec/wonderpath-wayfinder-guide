import { type Match } from '@/lib/game';
function Puller({ x, red = false, variant = 0 }: { x: number; red?: boolean; variant?: number }) {
  return <g transform={`translate(${x} ${variant * 3})`} className={`puller ${red ? 'puller-red' : ''}`}>
    <path d="M-12 245 L-25 279 L-48 286" className="character-limb" />
    <path d="M5 247 L25 275 L42 279" className="character-limb" />
    <path d="M-49 282 l-9 9 h24 l5-7 M34 275 l-4 10 h26 l-6-7" className="character-shoe" />
    <path d="M-18 201 Q-32 224 -14 253 L12 252 L19 217 L4 202Z" className={red ? 'shirt-red' : 'shirt-blue'} />
    <path d="M-7 208 L8 231 L40 225" className="character-arm" />
    <path d="M12 211 L27 219 L47 223" className="character-arm" />
    <circle cx="44" cy="224" r="5" className="character-skin" />
    <path d="M-12 207 l10 11 9-12" className="shirt-trim" />
    <rect x="-2" y="190" width="10" height="16" rx="4" className="character-skin" />
    <g transform="rotate(-13 0 183)"><ellipse cx="0" cy="182" rx="17" ry="20" className="character-skin" /><path d="M-17 181 Q-24 158 -3 158 Q17 155 18 176 L10 174 L7 168 Q-3 179 -17 177Z" className="character-hair" /><circle cx="9" cy="181" r="2" className="character-hair" /><path d="M5 193 q6 2 9-3" className="character-smile" /><path d="M-20 169 Q-6 163 13 164" className={red ? 'headband-red' : 'headband-blue'} /></g>
    <path d="M-18 230 l29 4 M-20 239 l29 4" className="shirt-trim" />
    <path d="M-13 248 L12 249" className="character-shorts" />
  </g>;
}
export function Arena({ match, solo = false }: { match: Match; solo?: boolean }) {
  const difference = match.players[1].score - match.players[0].score;
  const displacement = difference * 13;
  return <div className={`arena-illustration ${match.status === 'playing' ? 'arena-active' : ''}`}>
    <svg viewBox="0 0 640 380" role="img" aria-label={solo ? `Solo tug of war arena. You have answered ${match.players[0].score} correctly.` : `Tug of war arena, Team 1 ${match.players[0].score}, Team 2 ${match.players[1].score}`}>
      <defs><pattern id="rope-pattern" width="8" height="8" patternUnits="userSpaceOnUse"><path d="M0 0 L8 8 M-4 4 L4 12" className="rope-fiber" /></pattern></defs>
      <path d="M0 275 Q80 230 155 263 Q235 214 327 260 Q434 203 530 251 Q591 225 640 251 V380 H0Z" className="hill-back" />
      <path d="M0 303 Q137 261 240 301 Q350 247 469 294 Q564 255 640 284 V380 H0Z" className="hill-front" />
      <ellipse cx="320" cy="301" rx="270" ry="15" className="ground-shadow" />
      <path d="M320 77 V313" className="boundary" />
      <circle cx="320" cy="71" r="4" className="boundary-dot" />
      <path d="M90 294 V119 M550 294 V119" className="flagpole" />
      <path d="M90 120 h45 l-10 15 10 15 H90Z" className="shirt-blue" />
      <path d="M550 120 h-45 l10 15-10 15 H550Z" className="shirt-red" />
      <path d="M70 320 l4-10 4 10 M123 340 l4-10 5 9 M538 330 l4-10 4 10 M588 307 l4-10 4 10 M282 340 l4-8 4 8" className="grass" />
      <g className="rope-group" style={{ transform: `translateX(${displacement}px)` }}>
        <path d="M133 228 Q320 239 507 228" className="rope" /><path d="M133 228 Q320 239 507 228" stroke="url(#rope-pattern)" strokeWidth="5" fill="none" />
        <g><Puller x={158} variant={1} /><Puller x={224} /></g>
        {!solo && <g transform="translate(640 0) scale(-1 1)"><Puller x={158} red variant={1} /><Puller x={224} red /></g>}
        <path d="M320 233 l-10 28 10-4 10 4Z" className="rope-ribbon" /><path d="M316 231 h8" className="ribbon-knot" />
      </g>
      <path d="M315 321 h10 l-5-8Z" className="boundary-dot" />
    </svg>
  </div>;
}
