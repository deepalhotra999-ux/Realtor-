import { describe, expect, it } from "vitest";
import { LocalGeocodingProvider } from "./local";

const geo = new LocalGeocodingProvider();

describe("LocalGeocodingProvider", () => {
  it("resolves cities, neighborhoods and states offline", async () => {
    const [austin] = await geo.geocode("Austin, TX");
    expect(austin).toMatchObject({ kind: "city", city: "Austin", state: "TX" });
    expect(austin.bbox).toHaveLength(4);
    const [ballard] = await geo.geocode("ballard");
    expect(ballard).toMatchObject({ kind: "neighborhood", city: "Seattle" });
    const [co] = await geo.geocode("Colorado");
    expect(co.kind).toBe("state");
  });

  it("supports prefixes and ZIP codes", async () => {
    expect((await geo.geocode("nash"))[0]?.city).toBe("Nashville");
    expect((await geo.geocode("78704"))[0]).toMatchObject({ kind: "postal_code", city: "Austin" });
    expect(await geo.geocode("")).toEqual([]);
  });

  it("reverse geocodes to the nearest known place", async () => {
    const r = await geo.reverse(47.668, -122.384);
    expect(r?.neighborhood).toBe("Ballard");
    expect(await geo.reverse(0, 0)).toBeNull();
  });
});
