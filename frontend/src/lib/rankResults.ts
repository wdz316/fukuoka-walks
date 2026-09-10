import { destinationNameMatches } from "./places";
import type { Recommendation } from "./types";
import type { VisitFilter } from "./places";
import { filterNewDestinations } from "./places";

export interface RankOptions {
  /** Explicitly requested destination: it becomes the ONLY result. */
  pinQuery?: string;
  /** Prefix prepended to the pinned reason (already translated by caller). */
  pinnedPrefix?: string;
  visitFilter?: VisitFilter;
  visitedIds?: ReadonlySet<number>;
}

/**
 * Rank condition-search results (the verifier for "specified destination
 * shows ONLY that destination"):
 * - pinQuery matched → [pinned] only, reason prefixed.
 * - pinQuery unmatched → [] (caller shows not-found).
 * - no pinQuery → full list, optionally filtered to unvisited.
 * Never mutates the input array.
 */
export function rankResults(
  data: readonly Recommendation[],
  opts: RankOptions = {},
): Recommendation[] {
  const { pinQuery, pinnedPrefix = "", visitFilter = "any", visitedIds } = opts;
  if (pinQuery) {
    const idx = data.findIndex((r) =>
      destinationNameMatches(r.destination.name, pinQuery),
    );
    if (idx < 0) return [];
    const pinned: Recommendation = {
      ...data[idx],
      destination: { ...data[idx].destination },
      reason: `${pinnedPrefix}${data[idx].reason ?? ""}`,
    };
    return [pinned];
  }
  let ranked: Recommendation[] = [...data];
  if (visitFilter === "new" && visitedIds) {
    ranked = filterNewDestinations(ranked, visitedIds);
  }
  return ranked;
}
