import { describe, expect, it } from "vitest";
import { enqueueVisit } from "./visit-queue";

describe("offline visit queue", () => {
  it("does not silently accept a visit when browser storage is unavailable", async () => {
    await expect(enqueueVisit({ doctor_id: "doctor-1" })).rejects.toThrow(
      /stockage hors ligne indisponible/i
    );
  });
});
