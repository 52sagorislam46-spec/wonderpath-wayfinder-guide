import { doc, getDoc, onSnapshot, setDoc, updateDoc } from "firebase/firestore";
import { db } from "../../lib/firebase";

/* ---------------- Conversation privacy settings ---------------- */

export type ChatPrivacy = {
  /** Secret chat: messages are end-to-end encrypted on the device. */
  secret: boolean;
  /** Disappearing messages timer in ms (0 = off). */
  disappearMs: number;
};

export const DISAPPEAR_OPTIONS: { label: string; ms: number }[] = [
  { label: "Off", ms: 0 },
  { label: "1 hour", ms: 60 * 60 * 1000 },
  { label: "24 hours", ms: 24 * 60 * 60 * 1000 },
  { label: "7 days", ms: 7 * 24 * 60 * 60 * 1000 },
];

export const defaultPrivacy: ChatPrivacy = { secret: false, disappearMs: 0 };

export function subscribePrivacy(convId: string, cb: (p: ChatPrivacy) => void) {
  return onSnapshot(doc(db, "conversations", convId), (snap) => {
    const d = snap.data() ?? {};
    cb({
      secret: d["secretChat"] === true,
      disappearMs: typeof d["disappearMs"] === "number" ? (d["disappearMs"] as number) : 0,
    });
  });
}

export async function setSecretChat(convId: string, on: boolean) {
  await setDoc(doc(db, "conversations", convId), { secretChat: on }, { merge: true });
}

export async function setDisappearTimer(convId: string, ms: number) {
  await setDoc(doc(db, "conversations", convId), { disappearMs: ms }, { merge: true });
}

/** Marks a view-once photo as opened and removes its link so it can't be seen again. */
export async function consumeViewOnce(convId: string, msgId: string) {
  await updateDoc(doc(db, "conversations", convId, "messages", msgId), {
    mediaUrl: "",
    viewOnceOpened: true,
  });
}

/* ---------------- End-to-end encryption (ECDH P-256 + AES-GCM) ---------------- */

const privKeyStorage = (uid: string) => `fly_e2e_priv_${uid}`;
const sharedCache = new Map<string, CryptoKey>();

const b64 = (buf: ArrayBuffer | Uint8Array) => {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = "";
  bytes.forEach((b) => (s += String.fromCharCode(b)));
  return btoa(s);
};
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

/** Ensures this device has a key pair and the public half is published on the profile. */
export async function ensureMyKeys(uid: string): Promise<CryptoKey> {
  const stored = localStorage.getItem(privKeyStorage(uid));
  const userRef = doc(db, "users", uid);
  if (stored) {
    const { priv, pub } = JSON.parse(stored) as { priv: JsonWebKey; pub: JsonWebKey };
    const snap = await getDoc(userRef);
    const published = snap.data()?.["e2ePublicKey"] as JsonWebKey | undefined;
    if (!published || published.x !== pub.x) {
      await setDoc(userRef, { e2ePublicKey: pub }, { merge: true });
    }
    return crypto.subtle.importKey("jwk", priv, { name: "ECDH", namedCurve: "P-256" }, false, [
      "deriveKey",
    ]);
  }
  const pair = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, [
    "deriveKey",
  ]);
  const priv = await crypto.subtle.exportKey("jwk", pair.privateKey);
  const pub = await crypto.subtle.exportKey("jwk", pair.publicKey);
  localStorage.setItem(privKeyStorage(uid), JSON.stringify({ priv, pub }));
  await setDoc(userRef, { e2ePublicKey: pub }, { merge: true });
  return pair.privateKey;
}

async function sharedKey(meId: string, otherId: string): Promise<CryptoKey> {
  const cacheKey = `${meId}_${otherId}`;
  const cached = sharedCache.get(cacheKey);
  if (cached) return cached;
  const myPriv = await ensureMyKeys(meId);
  const snap = await getDoc(doc(db, "users", otherId));
  const theirPub = snap.data()?.["e2ePublicKey"] as JsonWebKey | undefined;
  if (!theirPub) {
    throw new Error("This person needs to open the app once before secret chat can start.");
  }
  const pubKey = await crypto.subtle.importKey(
    "jwk",
    theirPub,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    [],
  );
  const key = await crypto.subtle.deriveKey(
    { name: "ECDH", public: pubKey },
    myPriv,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
  sharedCache.set(cacheKey, key);
  return key;
}

export type Encrypted = { iv: string; ct: string };

export async function encryptText(meId: string, otherId: string, text: string): Promise<Encrypted> {
  const key = await sharedKey(meId, otherId);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(text));
  return { iv: b64(iv), ct: b64(ct) };
}

export async function decryptText(meId: string, otherId: string, enc: Encrypted): Promise<string> {
  const key = await sharedKey(meId, otherId);
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: unb64(enc.iv) },
    key,
    unb64(enc.ct),
  );
  return new TextDecoder().decode(plain);
}

/** Clears cached shared keys (e.g. when the other person changes devices). */
export function resetSharedKeys() {
  sharedCache.clear();
}
