import { describe, expect, it } from "vitest";
import type { SpcLibraryCard } from "@workspace/api-client-react";
import { rankSpcCards } from "./new";

function card(
  id: string,
  name: string,
  searchText: string,
  source = "exemplar-library",
): SpcLibraryCard {
  return {
    id,
    slug: name.toLowerCase().replaceAll(" ", "-"),
    name,
    provenance: {
      source,
      version: "1",
      status: "published",
      searchText,
    },
    status: "PRE_BUILD",
    preBuild: true,
    cheatSheetPublished: false,
    cheatSheet: null,
    thirdPartyDefinitions: null,
  };
}

describe("rankSpcCards", () => {
  it("ranks Exemplar Library SPCs against Capability Brief requirements", () => {
    const catalog = [
      card("00000000-0000-4000-8000-000000000001", "Revenue Planner", "pricing forecast margin"),
      card("00000000-0000-4000-8000-000000000002", "Safety Reviewer", "clinical compliance risk"),
      card("00000000-0000-4000-8000-000000000003", "Market Mapper", "pricing competitors market"),
    ];

    const ranked = rankSpcCards(
      catalog,
      "Pricing system",
      "Compare market competitors and forecast margin.",
    );

    expect(ranked.map((item) => item.name)).toEqual([
      "Market Mapper",
      "Revenue Planner",
    ]);
  });

  it("returns no automatic matches for an empty brief", () => {
    expect(
      rankSpcCards(
        [card("00000000-0000-4000-8000-000000000004", "Planner", "planning")],
        "",
        "",
      ),
    ).toEqual([]);
  });
});