import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  increment,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  limit,
  orderBy,
} from "firebase/firestore";
import { db } from "../../lib/firebase";
import { STARTER_STARS } from "./StarGift";
import { notifyUpload } from "../../lib/appNotifications";

/** A public one-to-many live broadcast. Signaling runs through Firestore. */
export interface LiveDoc {
  id: string;
  hostId: string;
  hostName: string;
  hostPhoto: string;
  title: string;
  status: "live" | "ended";
  publishers: string[];
  publisherInfo?: Record<string, { name: string; photo: string }>;
  likes?: number;
  stars?: number;
  viewers?: number;
  updatedAt?: number;
  startedAt?: number;
}

export interface LiveComment {
  id: string;
  uid: string;
  name: string;
  photo: string;
  text: string;
  at: number;
}

export interface LiveEvent {
  id: string;
  type: "like" | "gift" | "join";
  uid: string;
  name: string;
  photo: string;
  gift?: string;
  amount?: number;
  at: number;
}

export interface LiveGift {
  id: string;
  emoji: string;
  name: string;
  stars: number;
}

export const LIVE_GIFTS: LiveGift[] = [
  { id: "rose", emoji: "🌹", name: "Rose", stars: 1 },
  { id: "heart", emoji: "💖", name: "Heart", stars: 5 },
  { id: "star", emoji: "⭐", name: "Star", stars: 10 },
  { id: "crown", emoji: "👑", name: "Crown", stars: 50 },
  { id: "rocket", emoji: "🚀", name: "Rocket", stars: 100 },
  { id: "castle", emoji: "🏰", name: "Castle", stars: 500 },
];

/** Live is considered gone if the host stops sending heartbeats. */
export const LIVE_STALE_MS = 60_000;

export const liveRef = (id: string) => doc(db, "lives", id);

export function watchLives(cb: (lives: LiveDoc[]) => void): () => void {
  return onSnapshot(
    query(collection(db, "lives"), where("status", "==", "live")),
    (snap) => {
      const now = Date.now();
      cb(
        snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as Omit<LiveDoc, "id">) }))
          .filter((l) => (l.updatedAt ?? 0) > now - LIVE_STALE_MS)
          .sort((a, b) => (b.viewers ?? 0) - (a.viewers ?? 0)),
      );
    },
    () => cb([]),
  );
}

export function watchLive(id: string, cb: (l: LiveDoc | null) => void) {
  return onSnapshot(liveRef(id), (s) =>
    cb(s.exists() ? { id: s.id, ...(s.data() as Omit<LiveDoc, "id">) } : null),
  );
}

export async function startLive(host: { uid: string; name: string; photo: string }, title: string) {
  const ref = doc(collection(db, "lives"));
  await setDoc(ref, {
    hostId: host.uid,
    hostName: host.name,
    hostPhoto: host.photo,
    title: title.trim() || `${host.name} is live`,
    status: "live",
    publishers: [host.uid],
    publisherInfo: { [host.uid]: { name: host.name, photo: host.photo } },
    likes: 0,
    stars: 0,
    viewers: 0,
    startedAt: Date.now(),
    updatedAt: Date.now(),
    createdAt: serverTimestamp(),
  });
  // Tell everyone the host just went live (best effort).
  void notifyUpload({
    type: "live",
    actorId: host.uid,
    actorName: host.name,
    actorPhoto: host.photo,
    text: title.trim(),
  });
  return ref.id;
}

export const heartbeat = (id: string) =>
  updateDoc(liveRef(id), { updatedAt: Date.now() }).catch(() => {});

export const endLive = (id: string) =>
  updateDoc(liveRef(id), { status: "ended", updatedAt: Date.now() }).catch(() => {});

// ---- viewers ----
export async function joinAsViewer(id: string, me: { uid: string; name: string; photo: string }) {
  await setDoc(doc(db, "lives", id, "viewers", me.uid), { ...me, at: Date.now() }).catch(() => {});
  await updateDoc(liveRef(id), { viewers: increment(1) }).catch(() => {});
  void sendEvent(id, { type: "join", uid: me.uid, name: me.name, photo: me.photo });
}
export async function leaveAsViewer(id: string, uid: string) {
  await deleteDoc(doc(db, "lives", id, "viewers", uid)).catch(() => {});
  await updateDoc(liveRef(id), { viewers: increment(-1) }).catch(() => {});
}

// ---- comments & events ----
export function watchComments(id: string, cb: (c: LiveComment[]) => void) {
  return onSnapshot(
    query(collection(db, "lives", id, "comments"), orderBy("at", "desc"), limit(40)),
    (s) => cb(s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<LiveComment, "id">) })).reverse()),
  );
}
export const sendComment = (id: string, c: Omit<LiveComment, "id" | "at">) =>
  addDoc(collection(db, "lives", id, "comments"), { ...c, text: c.text.slice(0, 300), at: Date.now() });

export function watchEvents(id: string, since: number, cb: (e: LiveEvent) => void) {
  return onSnapshot(
    query(collection(db, "lives", id, "events"), where("at", ">", since)),
    (s) =>
      s.docChanges().forEach((ch) => {
        if (ch.type === "added") cb({ id: ch.doc.id, ...(ch.doc.data() as Omit<LiveEvent, "id">) });
      }),
  );
}
export const sendEvent = (id: string, e: Omit<LiveEvent, "id" | "at">) =>
  addDoc(collection(db, "lives", id, "events"), { ...e, at: Date.now() }).catch(() => {});

export async function sendLike(id: string, me: { uid: string; name: string; photo: string }) {
  await sendEvent(id, { type: "like", ...me });
  await updateDoc(liveRef(id), { likes: increment(1) }).catch(() => {});
}

/** Moves stars from the viewer to the host and shows the gift on screen. */
export async function sendLiveGift(
  live: LiveDoc,
  me: { uid: string; name: string; photo: string },
  gift: LiveGift,
) {
  await runTransaction(db, async (tx) => {
    const meRef = doc(db, "users", me.uid);
    const hostRef = doc(db, "users", live.hostId);
    const [a, b] = await Promise.all([tx.get(meRef), tx.get(hostRef)]);
    const mine = (a.data() as { stars?: number })?.stars ?? STARTER_STARS;
    if (mine < gift.stars) throw new Error("not-enough");
    const h = b.data() as { stars?: number; starsReceived?: number } | undefined;
    tx.set(meRef, { stars: mine - gift.stars }, { merge: true });
    tx.set(
      hostRef,
      { stars: (h?.stars ?? STARTER_STARS) + gift.stars, starsReceived: (h?.starsReceived ?? 0) + gift.stars },
      { merge: true },
    );
  });
  await sendEvent(live.id, { type: "gift", ...me, gift: gift.id, amount: gift.stars });
  await updateDoc(liveRef(live.id), { stars: increment(gift.stars) }).catch(() => {});
}

// ---- co-host ----
export interface CohostRequest { uid: string; name: string; photo: string; at: number }
export const requestCohost = (id: string, me: { uid: string; name: string; photo: string }) =>
  setDoc(doc(db, "lives", id, "requests", me.uid), { ...me, at: Date.now() });
export const cancelCohostRequest = (id: string, uid: string) =>
  deleteDoc(doc(db, "lives", id, "requests", uid)).catch(() => {});
export function watchRequests(id: string, cb: (r: CohostRequest[]) => void) {
  return onSnapshot(collection(db, "lives", id, "requests"), (s) =>
    cb(s.docs.map((d) => d.data() as CohostRequest)),
  );
}
export async function acceptCohost(id: string, r: CohostRequest) {
  await updateDoc(liveRef(id), {
    publishers: arrayUnion(r.uid),
    [`publisherInfo.${r.uid}`]: { name: r.name, photo: r.photo },
  });
  await cancelCohostRequest(id, r.uid);
}
export const removePublisher = (id: string, uid: string) =>
  updateDoc(liveRef(id), { publishers: arrayRemove(uid) }).catch(() => {});

// ---- WebRTC signaling (viewer offers, publisher answers) ----
export interface ConnDoc {
  viewer: string;
  publisher: string;
  offer?: RTCSessionDescriptionInit;
  answer?: RTCSessionDescriptionInit | null;
  ts: number;
}
export const connRef = (liveId: string, viewer: string, publisher: string) =>
  doc(db, "lives", liveId, "conns", `${viewer}__${publisher}`);
export function watchConnsFor(liveId: string, publisher: string, cb: (id: string, c: ConnDoc) => void) {
  return onSnapshot(
    query(collection(db, "lives", liveId, "conns"), where("publisher", "==", publisher)),
    (s) =>
      s.docChanges().forEach((ch) => {
        if (ch.type !== "removed") cb(ch.doc.id, ch.doc.data() as ConnDoc);
      }),
  );
}
