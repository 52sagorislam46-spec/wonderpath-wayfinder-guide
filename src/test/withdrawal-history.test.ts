import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("firebase/firestore", () => ({
  arrayUnion: (uid: string) => ({ union: uid }),
  doc: (_db: unknown, collection: string, id: string) => ({ collection, id }),
  updateDoc: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../lib/firebase", () => ({ db: {} }));

import { updateDoc } from "firebase/firestore";
import { isWithdrawalHistoryVisible, removeWithdrawalHistory } from "../components/fly/withdrawal-history";

describe("Withdrawal history removal", () => {
  beforeEach(() => vi.clearAllMocks());
  it("hides history only from the viewer who removed it", () => {
    expect(isWithdrawalHistoryVisible({ hiddenFrom: ["viewer"] }, "viewer")).toBe(false);
    expect(isWithdrawalHistoryVisible({ hiddenFrom: ["viewer"] }, "owner")).toBe(true);
    expect(isWithdrawalHistoryVisible({}, "viewer")).toBe(true);
  });
  it("changes only history visibility, never payment status or balances", async () => {
    await removeWithdrawalHistory("paid-request", "viewer");
    expect(updateDoc).toHaveBeenCalledExactlyOnceWith(
      { collection: "withdrawals", id: "paid-request" }, { hiddenFrom: { union: "viewer" } },
    );
  });
  it("does not write without a signed-in viewer", async () => {
    await expect(removeWithdrawalHistory("paid-request", "")).rejects.toThrow("Sign in required");
    expect(updateDoc).not.toHaveBeenCalled();
  });
});