import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { addDoc, collection, onSnapshot, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import {
  Eye,
  Gift,
  Heart,
  Loader2,
  Mic,
  MicOff,
  Radio,
  Send,
  SwitchCamera,
  UserPlus,
  Users,
  Volume2,
  X,
} from "lucide-react";
import { useAuth } from "./AuthContext";
import { useStarBalance } from "./StarGift";
import { useBackClose } from "./useBackClose";
import { RTC_CONFIG, ensureIceServers, waitForIceGathering } from "./calls";
import { DEFAULT_AVATAR, db, uploadToCloudinary } from "../../lib/firebase";
import { notifyUpload } from "../../lib/appNotifications";
import {
  LIVE_GIFTS,
  acceptCohost,
  cancelCohostRequest,
  connRef,
  endLive,
  heartbeat,
  joinAsViewer,
  leaveAsViewer,
  removePublisher,
  requestCohost,
  sendComment,
  sendLike,
  sendLiveGift,
  startLive,
  watchComments,
  watchConnsFor,
  watchEvents,
  watchLive,
  watchLives,
  watchRequests,
  type CohostRequest,
  type ConnDoc,
  type LiveComment,
  type LiveDoc,
  type LiveEvent,
} from "./live";

type Me = { uid: string; name: string; photo: string };

function useMe(): Me | null {
  const { user, profile } = useAuth();
  if (!user) return null;
  return {
    uid: user.uid,
    name: profile?.displayName || user.displayName || "Fly user",
    photo: profile?.photoURL || user.photoURL || DEFAULT_AVATAR,
  };
}

/**
 * Live button. Three variants:
 *  - "icon" (default): round header button.
 *  - "row": full-width menu row.
 *  - "tile": premium grid tile for the Fly menu.
 * Shows a red dot when someone is live.
 */
export function LiveButton({ variant = "icon" }: { variant?: "icon" | "row" | "tile" }) {
  const [open, setOpen] = useState(false);
  const [lives, setLives] = useState<LiveDoc[]>([]);
  useEffect(() => watchLives(setLives), []);
  if (variant === "tile") {
    return (
      <>
        <button
          onClick={() => setOpen(true)}
          aria-label="Live"
          className="rounded-2xl bg-white border border-gray-100 shadow-sm p-3 flex flex-col items-start gap-2.5 text-left hover:bg-gray-50 active:scale-[0.97] transition-all"
        >
          <span className="w-11 h-11 rounded-2xl bg-gradient-to-br from-rose-500 to-red-500 flex items-center justify-center text-white shadow-md">
            <Radio size={22} />
          </span>
          <span className="text-[13px] font-semibold text-gray-800 leading-tight flex items-center gap-1.5">
            Live
            {lives.length > 0 && (
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
            )}
          </span>
        </button>
        {open && typeof document !== "undefined" &&
          createPortal(<LiveHub lives={lives} onClose={() => setOpen(false)} />, document.body)}
      </>
    );
  }
  if (variant === "row") {
    return (
      <>
        <button
          onClick={() => setOpen(true)}
          aria-label="Live"
          className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left text-gray-800 hover:bg-gray-50"
        >
          <Radio size={20} className="text-gray-500" />
          <span className="text-sm font-medium">Live</span>
          {lives.length > 0 && (
            <span className="ml-auto w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
          )}
        </button>
        {open && typeof document !== "undefined" &&
          createPortal(<LiveHub lives={lives} onClose={() => setOpen(false)} />, document.body)}
      </>
    );
  }
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Live"
        className="relative w-9 h-9 rounded-full bg-gray-50 border border-gray-100 flex items-center justify-center text-rose-500 active:scale-90 transition-transform"
      >
        <Radio size={18} />
        {lives.length > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-rose-500 border-2 border-white animate-pulse" />
        )}
      </button>
      {open && typeof document !== "undefined" &&
        createPortal(<LiveHub lives={lives} onClose={() => setOpen(false)} />, document.body)}
    </>
  );
}

function LiveHub({ lives, onClose }: { lives: LiveDoc[]; onClose: () => void }) {
  const me = useMe();
  const [room, setRoom] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");
  useBackClose(true, onClose);

  const goLive = async () => {
    if (!me || starting) return;
    setStarting(true);
    setError("");
    try {
      // Ask for the camera first so the host sees the prompt right away.
      const test = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      test.getTracks().forEach((t) => t.stop());
      const id = await startLive(me, title);
      setRoom(id);
    } catch (e) {
      const msg = (e as Error).message ?? "";
      setError(
        /permission|denied|notallowed/i.test(msg)
          ? "ক্যামেরা/মাইকের অনুমতি দিন"
          : "লাইভ শুরু করা যায়নি, আবার চেষ্টা করুন",
      );
    } finally {
      setStarting(false);
    }
  };

  if (room) return <LiveRoom liveId={room} onClose={() => setRoom(null)} />;

  return (
    <div className="fixed inset-0 z-[90] bg-white overflow-y-auto animate-fade-in">
      <div className="mx-auto max-w-md">
        <header className="sticky top-0 bg-white/90 backdrop-blur-xl border-b border-gray-100 px-4 h-14 flex items-center gap-2 z-10">
          <button onClick={onClose} aria-label="Close" className="w-9 h-9 rounded-full flex items-center justify-center text-gray-500">
            <X size={20} />
          </button>
          <h1 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Radio size={18} className="text-rose-500" /> Live
          </h1>
        </header>
        <div className="p-4">
          <div className="rounded-3xl bg-gradient-to-br from-rose-500 to-orange-400 p-4 text-white shadow-lg">
            <p className="font-bold text-lg">লাইভে যান</p>
            <p className="text-sm text-white/80">সবাই আপনাকে সরাসরি দেখতে পারবে</p>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={80}
              placeholder="লাইভের শিরোনাম (ঐচ্ছিক)"
              className="mt-3 w-full h-11 rounded-2xl bg-white/20 placeholder:text-white/70 px-4 outline-none"
            />
            <button
              onClick={() => void goLive()}
              disabled={starting}
              className="mt-3 w-full h-11 rounded-2xl bg-white text-rose-600 font-bold flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {starting ? <Loader2 size={18} className="animate-spin" /> : <Radio size={18} />} Go Live
            </button>
            {error && <p className="text-sm mt-2 font-medium">{error}</p>}
          </div>

          <h2 className="mt-6 mb-3 font-bold text-gray-900">এখন লাইভে</h2>
          {lives.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-10">এই মুহূর্তে কেউ লাইভে নেই</p>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {lives.map((l) => (
                <button
                  key={l.id}
                  onClick={() => setRoom(l.id)}
                  className="relative aspect-[3/4] rounded-2xl overflow-hidden bg-gray-900 text-left active:scale-95 transition-transform"
                >
                  <img src={l.hostPhoto || DEFAULT_AVATAR} alt="" className="absolute inset-0 w-full h-full object-cover opacity-70" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                  <span className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-rose-500 text-white text-[10px] font-bold">LIVE</span>
                  <span className="absolute top-2 right-2 px-2 py-0.5 rounded-md bg-black/50 text-white text-[10px] flex items-center gap-1">
                    <Eye size={10} /> {Math.max(0, l.viewers ?? 0)}
                  </span>
                  <div className="absolute bottom-2 left-2 right-2 text-white">
                    <p className="text-sm font-bold truncate">{l.hostName}</p>
                    <p className="text-[11px] text-white/80 truncate">{l.title}</p>
                    {l.publishers.length > 1 && (
                      <p className="text-[10px] text-amber-300 flex items-center gap-1"><Users size={10} /> Co-host</p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function VideoTile({ stream, mirrored, muted, label }: { stream: MediaStream | null; mirrored?: boolean; muted?: boolean; label: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [blocked, setBlocked] = useState(false);
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    v.srcObject = stream;
    if (stream) v.play().catch(() => {
      if (!muted) {
        v.muted = true;
        setBlocked(true);
        void v.play().catch(() => {});
      }
    });
  }, [stream, muted]);
  return (
    <div className="relative flex-1 min-h-0 bg-gray-900 overflow-hidden">
      <video ref={ref} autoPlay playsInline muted={muted} className={`w-full h-full object-cover ${mirrored ? "-scale-x-100" : ""}`} />
      {!stream && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-white/70 gap-2">
          <Loader2 className="animate-spin" />
          <span className="text-xs">সংযোগ হচ্ছে…</span>
        </div>
      )}
      {blocked && (
        <button
          onClick={() => {
            if (ref.current) ref.current.muted = false;
            setBlocked(false);
          }}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 px-4 py-2 rounded-full bg-black/60 text-white text-sm flex items-center gap-2"
        >
          <Volume2 size={16} /> শব্দ চালু করুন
        </button>
      )}
      <span className="absolute bottom-2 right-2 px-2 py-0.5 rounded-md bg-black/40 text-white text-[10px]">{label}</span>
    </div>
  );
}

interface Floating { id: string; emoji: string; x: number }
interface GiftShow { id: string; emoji: string; name: string; who: string; photo: string; amount: number }

function LiveRoom({ liveId, onClose }: { liveId: string; onClose: () => void }) {
  const me = useMe();
  const [live, setLive] = useState<LiveDoc | null | undefined>(undefined);
  const [local, setLocal] = useState<MediaStream | null>(null);
  const [remotes, setRemotes] = useState<Record<string, MediaStream>>({});
  const [comments, setComments] = useState<LiveComment[]>([]);
  const [text, setText] = useState("");
  const [hearts, setHearts] = useState<Floating[]>([]);
  const [gifts, setGifts] = useState<GiftShow[]>([]);
  const [giftOpen, setGiftOpen] = useState(false);
  const [requests, setRequests] = useState<CohostRequest[]>([]);
  const [reqOpen, setReqOpen] = useState(false);
  const [requested, setRequested] = useState(false);
  const [micOn, setMicOn] = useState(true);
  const [facing, setFacing] = useState<"user" | "environment">("user");
  const [joinedAt] = useState(() => Date.now());
  const { profile } = useAuth();
  const [saving, setSaving] = useState(false);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);

  const isHost = !!me && live?.hostId === me.uid;
  const amPublisher = !!me && !!live?.publishers.includes(me.uid);
  const publishers = live?.publishers ?? [];
  const pubKey = publishers.join(",");

  /** Host: stop recording, end the live and upload the recording as a post. */
  const endAndSave = useCallback(async () => {
    if (saving) return;
    setSaving(true);
    const rec = recorder.current;
    const blob = await new Promise<Blob | null>((resolve) => {
      if (!rec || rec.state === "inactive") {
        resolve(chunks.current.length ? new Blob(chunks.current, { type: chunks.current[0]?.type || "video/webm" }) : null);
        return;
      }
      rec.onstop = () =>
        resolve(chunks.current.length ? new Blob(chunks.current, { type: rec.mimeType || "video/webm" }) : null);
      try {
        rec.stop();
      } catch {
        resolve(null);
      }
    });
    recorder.current = null;
    await endLive(liveId);
    if (blob && blob.size > 0 && me) {
      try {
        const ext = blob.type.includes("mp4") ? "mp4" : "webm";
        const file = new File([blob], `live-${liveId}.${ext}`, { type: blob.type || "video/webm" });
        const up = await uploadToCloudinary(file);
        const title = live?.title ?? "";
        await addDoc(collection(db, "posts"), {
          authorId: me.uid,
          authorName: profile?.displayName || me.name,
          authorUsername: profile?.username || "",
          authorPhoto: profile?.photoURL || me.photo,
          text: title ? `🔴 লাইভ: ${title}` : "🔴 লাইভ ভিডিও",
          mediaUrl: up.url,
          mediaType: "video",
          media: [],
          taggedUsers: [],
          bgStyle: "",
          exclusive: false,
          product: null,
          likes: [],
          comments: [],
          tags: ["live"],
          createdAt: serverTimestamp(),
        });
        void notifyUpload({
          type: "reel",
          actorId: me.uid,
          actorName: profile?.displayName || me.name,
          actorPhoto: profile?.photoURL || me.photo,
          followers: profile?.followers ?? [],
          text: title,
        });
      } catch {
        /* upload is best effort */
      }
    }
    setSaving(false);
    onClose();
  }, [saving, liveId, me, profile, live?.title, onClose]);

  const close = useCallback(() => {
    if (isHost) {
      void endAndSave();
      return;
    }
    else if (me && amPublisher) void removePublisher(liveId, me.uid);
    onClose();
  }, [isHost, amPublisher, liveId, me, onClose, endAndSave]);
  useBackClose(true, close);

  useEffect(() => watchLive(liveId, setLive), [liveId]);
  useEffect(() => watchComments(liveId, setComments), [liveId]);

  // Host heartbeat keeps the live listed; ends it if the host leaves.
  useEffect(() => {
    if (!isHost) return;
    void heartbeat(liveId);
    const t = setInterval(() => void heartbeat(liveId), 15_000);
    const end = () => void endLive(liveId);
    window.addEventListener("pagehide", end);
    return () => {
      clearInterval(t);
      window.removeEventListener("pagehide", end);
    };
  }, [isHost, liveId]);

  // Viewer presence.
  const meUid = me?.uid;
  useEffect(() => {
    if (!me || live === undefined || !live || isHost) return;
    void joinAsViewer(liveId, me);
    const leave = () => void leaveAsViewer(liveId, me.uid);
    window.addEventListener("pagehide", leave);
    return () => {
      window.removeEventListener("pagehide", leave);
      leave();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveId, meUid, isHost, live === undefined || live === null]);

  // Floating likes & gift animations.
  const addHeart = useCallback((emoji = "❤️") => {
    const h = { id: Math.random().toString(36).slice(2), emoji, x: Math.random() * 40 };
    setHearts((p) => [...p.slice(-30), h]);
    setTimeout(() => setHearts((p) => p.filter((x) => x.id !== h.id)), 2600);
  }, []);
  useEffect(
    () =>
      watchEvents(liveId, joinedAt - 1000, (e: LiveEvent) => {
        if (e.type === "like" && e.uid !== meUid) addHeart(["❤️", "💖", "💗", "💕"][Math.floor(Math.random() * 4)]);
        if (e.type === "gift") {
          const g = LIVE_GIFTS.find((x) => x.id === e.gift);
          const show: GiftShow = { id: e.id, emoji: g?.emoji ?? "🎁", name: g?.name ?? "Gift", who: e.name, photo: e.photo, amount: e.amount ?? 0 };
          setGifts((p) => [...p, show]);
          setTimeout(() => setGifts((p) => p.filter((x) => x.id !== show.id)), 3200);
        }
      }),
    [liveId, joinedAt, meUid, addHeart],
  );

  useEffect(() => {
    if (!isHost) return;
    return watchRequests(liveId, setRequests);
  }, [isHost, liveId]);

  // ---- Camera for publishers (host + accepted co-hosts) ----
  useEffect(() => {
    if (!amPublisher) {
      setLocal((s) => {
        s?.getTracks().forEach((t) => t.stop());
        return null;
      });
      return;
    }
    let stopped = false;
    let stream: MediaStream | null = null;
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: facing, width: { ideal: 720 }, height: { ideal: 1280 } }, audio: { echoCancellation: true, noiseSuppression: true } })
      .then((s) => {
        if (stopped) return s.getTracks().forEach((t) => t.stop());
        stream = s;
        s.getAudioTracks().forEach((t) => (t.enabled = micOn));
        setLocal(s);
      })
      .catch(() => {});
    return () => {
      stopped = true;
      stream?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [amPublisher, facing]);

  useEffect(() => {
    local?.getAudioTracks().forEach((t) => (t.enabled = micOn));
  }, [micOn, local]);

  // Host: record the broadcast so it can be uploaded when the live ends.
  // The camera stream is drawn onto a canvas and the mic is routed through an
  // AudioContext, so the recording keeps running for the whole live even when
  // the camera is flipped or the camera stream is recreated.
  const recSrc = useRef<{ video: HTMLVideoElement; ctx: AudioContext | null; dest: MediaStreamAudioDestinationNode | null; node: MediaStreamAudioSourceNode | null } | null>(null);
  useEffect(() => {
    if (!isHost || !local || typeof MediaRecorder === "undefined") return;
    // Already recording: just swap the source to the new camera stream.
    if (recorder.current && recSrc.current) {
      const src = recSrc.current;
      src.video.srcObject = local;
      void src.video.play().catch(() => {});
      if (src.ctx && src.dest) {
        try {
          src.node?.disconnect();
          src.node = local.getAudioTracks().length ? src.ctx.createMediaStreamSource(local) : null;
          src.node?.connect(src.dest);
        } catch { /* ignore */ }
      }
      return;
    }
    if (recorder.current) return;
    try {
      const video = document.createElement("video");
      video.muted = true;
      video.playsInline = true;
      video.srcObject = local;
      void video.play().catch(() => {});
      const canvas = document.createElement("canvas");
      canvas.width = 540;
      canvas.height = 960;
      const g = canvas.getContext("2d");
      const draw = setInterval(() => {
        if (!g || video.readyState < 2) return;
        const vw = video.videoWidth || 540;
        const vh = video.videoHeight || 960;
        const scale = Math.max(canvas.width / vw, canvas.height / vh);
        const w = vw * scale;
        const h = vh * scale;
        g.drawImage(video, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h);
      }, 1000 / 24);
      let ctx: AudioContext | null = null;
      let dest: MediaStreamAudioDestinationNode | null = null;
      let node: MediaStreamAudioSourceNode | null = null;
      try {
        const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        ctx = new AC();
        void ctx.resume().catch(() => {});
        dest = ctx.createMediaStreamDestination();
        if (local.getAudioTracks().length) {
          node = ctx.createMediaStreamSource(local);
          node.connect(dest);
        }
      } catch { ctx = null; dest = null; }
      const out = canvas.captureStream(24);
      dest?.stream.getAudioTracks().forEach((t) => out.addTrack(t));
      const types = ["video/webm;codecs=vp8,opus", "video/webm", "video/mp4"];
      const mimeType = types.find((t) => MediaRecorder.isTypeSupported?.(t));
      const rec = new MediaRecorder(out, { ...(mimeType ? { mimeType } : {}), videoBitsPerSecond: 800_000, audioBitsPerSecond: 64_000 });
      chunks.current = [];
      rec.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunks.current.push(e.data);
      };
      rec.addEventListener("stop", () => {
        clearInterval(draw);
        out.getTracks().forEach((t) => t.stop());
        void ctx?.close().catch(() => {});
      });
      rec.start(1000);
      recorder.current = rec;
      recSrc.current = { video, ctx, dest, node };
    } catch {
      /* recording not supported on this device */
    }
  }, [isHost, local]);

  // Live duration timer.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const liveSecs = Math.max(0, Math.floor((now - (live?.startedAt ?? joinedAt)) / 1000));
  const liveTime = `${liveSecs >= 3600 ? `${Math.floor(liveSecs / 3600)}:` : ""}${String(Math.floor((liveSecs % 3600) / 60)).padStart(2, "0")}:${String(liveSecs % 60).padStart(2, "0")}`;

  // ---- Publisher: answer every viewer's offer ----
  const servePcs = useRef<Map<string, { pc: RTCPeerConnection; ts: number }>>(new Map());
  useEffect(() => {
    if (!amPublisher || !local || !meUid) return;
    const pcs = servePcs.current;
    const unsub = watchConnsFor(liveId, meUid, async (id, c: ConnDoc) => {
      if (!c.offer || c.answer) return;
      const prev = pcs.get(id);
      if (prev && prev.ts >= c.ts) return;
      prev?.pc.close();
      await ensureIceServers();
      const pc = new RTCPeerConnection(RTC_CONFIG);
      pcs.set(id, { pc, ts: c.ts });
      local.getTracks().forEach((t) => pc.addTrack(t, local));
      try {
        await pc.setRemoteDescription(c.offer);
        await pc.setLocalDescription(await pc.createAnswer());
        await waitForIceGathering(pc, 3000);
        const d = pc.localDescription;
        if (d && pcs.get(id)?.pc === pc)
          await updateDoc(connRef(liveId, c.viewer, meUid), { answer: { type: d.type, sdp: d.sdp }, ts: c.ts });
      } catch {
        pc.close();
      }
    });
    return () => {
      unsub();
      pcs.forEach((p) => p.pc.close());
      pcs.clear();
    };
  }, [amPublisher, local, meUid, liveId]);

  // Swap camera track for live viewers when flipping the camera.
  useEffect(() => {
    const track = local?.getVideoTracks()[0];
    if (!track) return;
    servePcs.current.forEach(({ pc }) =>
      pc.getSenders().forEach((s) => {
        if (s.track?.kind === "video" && s.track !== track) void s.replaceTrack(track);
      }),
    );
  }, [local]);

  // ---- Viewer: connect to every publisher except me ----
  useEffect(() => {
    if (!meUid || !live || live.status !== "live") return;
    const targets = publishers.filter((p) => p !== meUid);
    const cleanups: (() => void)[] = [];
    for (const pub of targets) {
      let pc: RTCPeerConnection | null = null;
      let unsub: (() => void) | null = null;
      let retry: ReturnType<typeof setTimeout> | null = null;
      let dead = false;
      const connect = async () => {
        if (dead) return;
        unsub?.();
        pc?.close();
        await ensureIceServers();
        const p = new RTCPeerConnection(RTC_CONFIG);
        pc = p;
        p.addTransceiver("video", { direction: "recvonly" });
        p.addTransceiver("audio", { direction: "recvonly" });
        p.ontrack = (ev) => {
          const s = ev.streams[0] ?? new MediaStream([ev.track]);
          setRemotes((r) => ({ ...r, [pub]: s }));
        };
        p.onconnectionstatechange = () => {
          if (p.connectionState === "failed" || p.connectionState === "disconnected") {
            if (retry) clearTimeout(retry);
            retry = setTimeout(() => void connect(), 2500);
          }
        };
        await p.setLocalDescription(await p.createOffer());
        await waitForIceGathering(p, 3000);
        if (dead || pc !== p) return;
        const ts = Date.now();
        const ref = connRef(liveId, meUid, pub);
        const d = p.localDescription!;
        await setDoc(ref, { viewer: meUid, publisher: pub, offer: { type: d.type, sdp: d.sdp }, answer: null, ts }).catch(() => {});
        unsub = onSnapshot(ref, (s) => {
          const c = s.data() as ConnDoc | undefined;
          if (c?.answer && c.ts === ts && p.signalingState === "have-local-offer")
            void p.setRemoteDescription(c.answer).catch(() => {});
        });
        // No answer in time → try again (publisher camera may still be starting).
        retry = setTimeout(() => {
          if (p.connectionState !== "connected") void connect();
        }, 15_000);
      };
      void connect();
      cleanups.push(() => {
        dead = true;
        if (retry) clearTimeout(retry);
        unsub?.();
        pc?.close();
        setRemotes((r) => {
          const n = { ...r };
          delete n[pub];
          return n;
        });
      });
    }
    return () => cleanups.forEach((c) => c());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pubKey, meUid, liveId, live?.status]);

  // Stop camera when leaving.
  useEffect(() => () => local?.getTracks().forEach((t) => t.stop()), [local]);

  const lastLike = useRef(0);
  const like = () => {
    if (!me) return;
    addHeart();
    const now = Date.now();
    if (now - lastLike.current < 400) return;
    lastLike.current = now;
    void sendLike(liveId, me);
  };

  const submit = () => {
    const t = text.trim();
    if (!t || !me) return;
    setText("");
    void sendComment(liveId, { uid: me.uid, name: me.name, photo: me.photo, text: t });
  };

  if (live === undefined)
    return (
      <div className="fixed inset-0 z-[95] bg-black flex items-center justify-center">
        <Loader2 className="animate-spin text-white" />
      </div>
    );

  if (!live || live.status === "ended")
    return (
      <div className="fixed inset-0 z-[95] bg-gray-950 text-white flex flex-col items-center justify-center gap-3 px-6 text-center">
        <Radio size={40} className="text-rose-400" />
        <p className="text-lg font-bold">লাইভ শেষ হয়েছে</p>
        {live && (
          <p className="text-sm text-white/70">❤️ {live.likes ?? 0} · ⭐ {live.stars ?? 0}</p>
        )}
        <button onClick={onClose} className="mt-2 px-6 h-11 rounded-2xl bg-white text-gray-900 font-bold">ফিরে যান</button>
      </div>
    );

  const info = (uid: string) => live.publisherInfo?.[uid] ?? { name: "", photo: "" };

  return (
    <div className="fixed inset-0 z-[95] bg-black text-white flex justify-center animate-fade-in">
      <div className="relative w-full max-w-md h-full flex flex-col">
        {/* Videos */}
        <div className="absolute inset-0 flex flex-col">
          {publishers.map((p) => (
            <VideoTile
              key={p}
              stream={p === meUid ? local : remotes[p] ?? null}
              muted={p === meUid}
              mirrored={p === meUid && facing === "user"}
              label={p === live.hostId ? info(p).name : `Co-host · ${info(p).name}`}
            />
          ))}
        </div>
        <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-black/50 via-transparent to-black/70" />

        {/* Top bar */}
        <div className="relative z-10 flex items-center gap-2 p-3">
          <div className="flex items-center gap-2 bg-black/40 rounded-full pr-3 p-1 min-w-0">
            <img src={live.hostPhoto || DEFAULT_AVATAR} alt="" className="w-8 h-8 rounded-full object-cover" />
            <div className="min-w-0">
              <p className="text-xs font-bold truncate max-w-[120px]">{live.hostName}</p>
              <p className="text-[10px] text-white/70">❤️ {live.likes ?? 0} · ⭐ {live.stars ?? 0}</p>
            </div>
          </div>
          <span className="px-2 py-0.5 rounded-md bg-rose-500 text-[10px] font-bold flex items-center gap-1">LIVE <span className="font-mono tabular-nums">{liveTime}</span></span>
          <span className="px-2 py-0.5 rounded-md bg-black/40 text-[10px] flex items-center gap-1">
            <Eye size={11} /> {Math.max(0, live.viewers ?? 0)}
          </span>
          {isHost && (
            <button onClick={() => setReqOpen(true)} aria-label="Co-host requests" className="relative ml-auto w-9 h-9 rounded-full bg-black/40 flex items-center justify-center">
              <UserPlus size={17} />
              {requests.length > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-[10px] font-bold flex items-center justify-center">{requests.length}</span>
              )}
            </button>
          )}
          {isHost ? (
            <button onClick={close} disabled={saving} aria-label="End live" className="px-3 h-9 rounded-full bg-rose-500 text-xs font-bold flex items-center gap-1 disabled:opacity-70">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <X size={14} />}
              {saving ? "আপলোড হচ্ছে…" : "লাইভ শেষ"}
            </button>
          ) : (
            <button onClick={close} aria-label="Leave live" className="ml-auto w-9 h-9 rounded-full bg-black/40 flex items-center justify-center">
              <X size={18} />
            </button>
          )}
        </div>

        {/* Gift banners */}
        <div className="relative z-10 px-3 space-y-2 pointer-events-none">
          {gifts.slice(-3).map((g) => (
            <div key={g.id} className="live-gift-banner flex items-center gap-2 bg-gradient-to-r from-amber-500/90 to-rose-500/80 rounded-full p-1 pr-4 w-max max-w-full">
              <img src={g.photo || DEFAULT_AVATAR} alt="" className="w-8 h-8 rounded-full object-cover" />
              <div className="text-xs leading-tight min-w-0">
                <p className="font-bold truncate">{g.who}</p>
                <p className="text-white/90">sent {g.name} · {g.amount}⭐</p>
              </div>
              <span className="text-3xl live-gift-pop">{g.emoji}</span>
            </div>
          ))}
        </div>
        {gifts.length > 0 && (
          <div key={gifts[gifts.length - 1]!.id} className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
            <span className="text-[120px] live-gift-big">{gifts[gifts.length - 1]!.emoji}</span>
          </div>
        )}

        {/* Floating hearts */}
        <div className="absolute right-3 bottom-24 w-16 h-72 z-10 pointer-events-none">
          {hearts.map((h) => (
            <span key={h.id} className="live-heart absolute bottom-0 text-3xl" style={{ right: `${h.x}%` }}>{h.emoji}</span>
          ))}
        </div>

        <div className="flex-1" />

        {/* Comments */}
        <div className="relative z-10 px-3 max-h-[35%] overflow-hidden flex flex-col justify-end gap-1.5 [mask-image:linear-gradient(to_bottom,transparent,black_30%)]">
          {comments.slice(-10).map((c) => (
            <div key={c.id} className="flex items-start gap-2 max-w-[80%] animate-fade-in">
              <img src={c.photo || DEFAULT_AVATAR} alt="" className="w-6 h-6 rounded-full object-cover shrink-0" />
              <p className="text-xs bg-black/35 rounded-2xl px-2.5 py-1.5 break-words">
                <b className="text-amber-200 mr-1">{c.name}</b>
                {c.text}
              </p>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="relative z-10 flex items-center gap-2 p-3">
          {isHost ? (
            <div className="flex-1 text-xs text-white/70 pl-1">💬 {comments.length} কমেন্ট</div>
          ) : (
          <form
            className="flex-1 flex items-center bg-black/40 rounded-full pl-4 pr-1 h-10"
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            <input value={text} onChange={(e) => setText(e.target.value)} placeholder="কমেন্ট করুন…" maxLength={300} className="flex-1 min-w-0 bg-transparent text-sm outline-none placeholder:text-white/60" />
            <button type="submit" aria-label="Send" className="w-8 h-8 rounded-full flex items-center justify-center text-sky-300">
              <Send size={16} />
            </button>
          </form>
          )}
          {amPublisher ? (
            <>
              <button onClick={() => setMicOn((m) => !m)} aria-label="Microphone" className="w-10 h-10 rounded-full bg-black/40 flex items-center justify-center">
                {micOn ? <Mic size={18} /> : <MicOff size={18} className="text-rose-400" />}
              </button>
              <button onClick={() => setFacing((f) => (f === "user" ? "environment" : "user"))} aria-label="Flip camera" className="w-10 h-10 rounded-full bg-black/40 flex items-center justify-center">
                <SwitchCamera size={18} />
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => {
                  if (!me) return;
                  if (requested) {
                    void cancelCohostRequest(liveId, me.uid);
                    setRequested(false);
                  } else {
                    void requestCohost(liveId, me).then(() => setRequested(true)).catch(() => {});
                  }
                }}
                aria-label="Request co-host"
                className={`w-10 h-10 rounded-full flex items-center justify-center ${requested ? "bg-sky-500" : "bg-black/40"}`}
                title={requested ? "অনুরোধ পাঠানো হয়েছে" : "Co-host অনুরোধ"}
              >
                <UserPlus size={18} />
              </button>
              <button onClick={() => setGiftOpen(true)} aria-label="Send gift" className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-400 to-rose-500 flex items-center justify-center">
                <Gift size={18} />
              </button>
            </>
          )}
          <button onClick={like} aria-label="Like" className="w-10 h-10 rounded-full bg-rose-500 flex items-center justify-center active:scale-90 transition-transform">
            <Heart size={18} className="fill-current" />
          </button>
        </div>

        {giftOpen && me && <GiftSheet live={live} me={me} onClose={() => setGiftOpen(false)} />}
        {reqOpen && isHost && (
          <RequestSheet
            liveId={liveId}
            requests={requests}
            cohosts={publishers.filter((p) => p !== live.hostId).map((p) => ({ uid: p, ...info(p) }))}
            onClose={() => setReqOpen(false)}
          />
        )}
      </div>
    </div>
  );
}

function GiftSheet({ live, me, onClose }: { live: LiveDoc; me: Me; onClose: () => void }) {
  const balance = useStarBalance(me.uid);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const send = async (id: string) => {
    const g = LIVE_GIFTS.find((x) => x.id === id)!;
    setBusy(id);
    setError("");
    try {
      await sendLiveGift(live, me, g);
    } catch (e) {
      setError((e as Error).message === "not-enough" ? "পর্যাপ্ত স্টার নেই" : "পাঠানো যায়নি, আবার চেষ্টা করুন");
    } finally {
      setBusy(null);
    }
  };
  return (
    <div className="absolute inset-0 z-20 flex items-end bg-black/30" onClick={onClose}>
      <div className="w-full bg-gray-950/95 rounded-t-3xl p-4 animate-scale-in" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <p className="font-bold flex items-center gap-2"><Gift size={18} className="text-amber-400" /> গিফট পাঠান</p>
          <p className="text-sm text-amber-300 font-semibold">{balance ?? "…"} ⭐</p>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {LIVE_GIFTS.map((g) => (
            <button
              key={g.id}
              onClick={() => void send(g.id)}
              disabled={!!busy || balance === null || balance < g.stars}
              className="py-3 rounded-2xl bg-white/5 border border-white/10 flex flex-col items-center gap-1 active:scale-95 transition-transform disabled:opacity-40"
            >
              <span className="text-3xl">{busy === g.id ? <Loader2 className="animate-spin" /> : g.emoji}</span>
              <span className="text-xs">{g.name}</span>
              <span className="text-[11px] text-amber-300">{g.stars} ⭐</span>
            </button>
          ))}
        </div>
        {error && <p className="text-sm text-rose-400 mt-3">{error}</p>}
      </div>
    </div>
  );
}

function RequestSheet({
  liveId,
  requests,
  cohosts,
  onClose,
}: {
  liveId: string;
  requests: CohostRequest[];
  cohosts: { uid: string; name: string; photo: string }[];
  onClose: () => void;
}) {
  return (
    <div className="absolute inset-0 z-20 flex items-end bg-black/30" onClick={onClose}>
      <div className="w-full bg-gray-950/95 rounded-t-3xl p-4 max-h-[60%] overflow-y-auto animate-scale-in" onClick={(e) => e.stopPropagation()}>
        <p className="font-bold mb-3 flex items-center gap-2"><Users size={18} /> Co-host</p>
        {cohosts.map((c) => (
          <div key={c.uid} className="flex items-center gap-3 py-2">
            <img src={c.photo || DEFAULT_AVATAR} alt="" className="w-9 h-9 rounded-full object-cover" />
            <p className="flex-1 text-sm font-semibold truncate">{c.name} <span className="text-[10px] text-emerald-400">লাইভে</span></p>
            <button onClick={() => void removePublisher(liveId, c.uid)} className="px-3 h-8 rounded-full bg-white/10 text-xs">সরান</button>
          </div>
        ))}
        {requests.length === 0 && cohosts.length === 0 && (
          <p className="text-sm text-white/60 py-6 text-center">এখনো কোনো অনুরোধ নেই</p>
        )}
        {requests.map((r) => (
          <div key={r.uid} className="flex items-center gap-3 py-2">
            <img src={r.photo || DEFAULT_AVATAR} alt="" className="w-9 h-9 rounded-full object-cover" />
            <p className="flex-1 text-sm font-semibold truncate">{r.name}</p>
            <button onClick={() => void cancelCohostRequest(liveId, r.uid)} className="px-3 h-8 rounded-full bg-white/10 text-xs">না</button>
            <button onClick={() => void acceptCohost(liveId, r)} className="px-3 h-8 rounded-full bg-sky-500 text-xs font-bold">যোগ করুন</button>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Timeline strip: shows everyone who is live right now. Tap to watch. */
export function LiveNowStrip() {
  const [lives, setLives] = useState<LiveDoc[]>([]);
  const [room, setRoom] = useState<string | null>(null);
  useEffect(() => watchLives(setLives), []);
  if (lives.length === 0 && !room) return null;
  return (
    <>
      {lives.length > 0 && (
        <div className="px-4 py-3 border-b border-gray-100">
          <p className="text-xs font-bold text-rose-500 mb-2 flex items-center gap-1">
            <Radio size={14} /> এখন লাইভে
          </p>
          <div className="flex gap-3 overflow-x-auto">
            {lives.map((l) => (
              <button
                key={l.id}
                onClick={() => setRoom(l.id)}
                className="shrink-0 w-28 rounded-2xl overflow-hidden relative bg-gray-900 text-white text-left active:scale-95 transition-transform"
              >
                <img src={l.hostPhoto || DEFAULT_AVATAR} alt="" className="w-28 h-36 object-cover opacity-80" />
                <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-rose-500 text-[9px] font-bold">LIVE</span>
                <span className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded bg-black/50 text-[9px] flex items-center gap-0.5">
                  <Eye size={9} /> {Math.max(0, l.viewers ?? 0)}
                </span>
                <div className="absolute bottom-0 inset-x-0 p-1.5 bg-gradient-to-t from-black/80 to-transparent">
                  <p className="text-[11px] font-bold truncate">{l.hostName}</p>
                  <p className="text-[10px] text-white/80 truncate">{l.title}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
      {room && typeof document !== "undefined" &&
        createPortal(<LiveRoom liveId={room} onClose={() => setRoom(null)} />, document.body)}
    </>
  );
}
