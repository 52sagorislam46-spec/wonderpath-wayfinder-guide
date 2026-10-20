import type { TouchEvent } from "react";

/**
 * Swipe-to-reply touch handlers for a chat message row.
 * Your own messages (right side) reply when swiped left; the other person's
 * messages (left side) reply when swiped right.
 */
const THRESHOLD = 60;
const MAX = 90;

type State = { x: number; y: number; dx: number; locked: "h" | "v" | null };
const states = new WeakMap<HTMLElement, State>();

export function swipeReplyHandlers(mine: boolean, onReply: () => void) {
  return {
    onTouchStart: (e: TouchEvent<HTMLElement>) => {
      const t = e.touches[0];
      states.set(e.currentTarget, { x: t.clientX, y: t.clientY, dx: 0, locked: null });
      e.currentTarget.style.transition = "none";
    },
    onTouchMove: (e: TouchEvent<HTMLElement>) => {
      const el = e.currentTarget;
      const s = states.get(el);
      if (!s) return;
      const t = e.touches[0];
      const rawX = t.clientX - s.x;
      const rawY = t.clientY - s.y;
      if (!s.locked) {
        if (Math.abs(rawX) < 8 && Math.abs(rawY) < 8) return;
        s.locked = Math.abs(rawX) > Math.abs(rawY) ? "h" : "v";
      }
      if (s.locked !== "h") return;
      const allowed = mine ? Math.min(0, rawX) : Math.max(0, rawX);
      s.dx = Math.max(-MAX, Math.min(MAX, allowed));
      el.style.transform = `translateX(${s.dx}px)`;
    },
    onTouchEnd: (e: TouchEvent<HTMLElement>) => {
      const el = e.currentTarget;
      const s = states.get(el);
      states.delete(el);
      el.style.transition = "transform 0.2s ease";
      el.style.transform = "translateX(0)";
      if (s && Math.abs(s.dx) >= THRESHOLD) {
        try {
          navigator.vibrate?.(15);
        } catch {
          /* ignore */
        }
        onReply();
      }
    },
    onTouchCancel: (e: TouchEvent<HTMLElement>) => {
      states.delete(e.currentTarget);
      e.currentTarget.style.transition = "transform 0.2s ease";
      e.currentTarget.style.transform = "translateX(0)";
    },
  };
}
