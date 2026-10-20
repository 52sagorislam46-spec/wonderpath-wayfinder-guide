import { arrayUnion, doc, updateDoc } from "firebase/firestore";
import { db } from "../../lib/firebase";

export function isWithdrawalHistoryVisible(record: { hiddenFrom?: string[] }, uid: string) {
  return !record.hiddenFrom?.includes(uid);
}

/** Remove only this viewer's history entry; keep payment and balance records. */
export async function removeWithdrawalHistory(id: string, uid: string) {
  if (!uid) throw new Error("Sign in required");
  await updateDoc(doc(db, "withdrawals", id), { hiddenFrom: arrayUnion(uid) });
}