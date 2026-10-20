# Americano scheduling corrections

Keep the existing next-round/manual-finish workflow and Mexicano behavior. Persist future Americano rounds so reloads and score corrections do not change them.

## Construction

Use verified whist designs for supported roster sizes, including 4, 5, 8, 9, 12, 13, 16, 17, 20, 21, 24 and 25: every partnership once and every opposition twice. Compare seeded relabellings against all historical matches without trading away these invariants for match variety. For other feasible sizes retain complete partnership construction and minimize opposition imbalance. For 4k+2/4k+3 players, cover every partnership and try the minimum one duplicate partnership per rotation; choose its participants using prior appearances and partnership counts.

## Courts and rests

Separate the set of matches from their chronological order. Pack complete matches into full, conflict-free rounds, allowing adjacent internal rotations to share only their boundary round. Plan enough rotations together for the total match count to fill the courts. First keep full template groups and move surplus games into additional rounds; use bounded exact-cover search when needed. Order rounds using historical appearances, rest recency, deterministic restarts and local swaps. Small schedules also receive bounded prefix-balance repair. Never silently leave courts empty to complete a template group.

If fixed-game packing exhausts its budget, construct full rounds of partnership matchings with alternating-path exchanges, then choose opponents. This guarantees complete chronological partner rotations and full courts without further packing search, but opposition balance becomes approximate. For incomplete fields, a final coverage fallback consumes at least one uncovered partnership per full round and may require more than the minimum extra partnership. These fallbacks keep unusual large fields playable; they do not claim a mathematically optimal schedule. Identical games are minimized against full history, not absolutely forbidden when repeats are unavoidable or bounded search cannot find a repeat-free alternative.

## Alternatives considered

Increasing weighted penalties does not guarantee coverage or opposition balance. Unrestricted global search is too costly in the browser. Verified constructions plus bounded match packing retain clear invariants and predictable search limits.

## Persistence and verification

Version cached plans so the previous planner's unfinished schedules can be replaced while preserving actual rounds and scores. Validate the resulting schedule and test full courts, partnership coverage, opposition balance, rests across boundaries, legacy saves, multiple rotations, repeat handling, and deterministic JSON round trips. Differentially compare Mexicano with the PR base, including correction of earlier results. Measure planning cost for representative larger rosters.
