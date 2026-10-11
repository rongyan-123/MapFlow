# Four-interface integrated acceptance

Continuation of the approved four-interface design after incorporating mobile commits `183a744` and `13e3bba`.

1. Exercise the built frontend against the actual isolated server and DSH worker. Check all four pages, desktop/mobile navigation, area/chat creation, scoped histories, node references and lazy map/canvas rendering without model calls on navigation. Keep private fixtures outside Git.
2. For defects reproduced during acceptance, first add a failing behavioral test, then the smallest fix. In particular, keep auxiliary navigation reachable on the mobile area selection layer, permit safe history navigation during a bound background run, consume successfully recovered references and enforce archived read-only history.
3. Complete confirmed tool permissions, with explicit versioned confirmation for note/progress changes and no independent-tavern learning access. Verify ownership, conflicts, replay and authorization changes before committing.
4. Send actual billed requests through the same server/worker for management directory, learning reading/drawing and independent role chat; verify persisted usage, exact charges, tool records and unique settlement. Separate actual acceptance evidence from mocked runtime tests.
5. Run all configured suites/types/build, inspect the complete diff, obtain a fresh-context whole-branch review, fix important findings with RED/GREEN tests and prepare a reviewable integration candidate. Production merge/deployment remains a final approval step.

Ruling: keep the user's compact mobile conversation toolbar; restore only a compact navigation control where the new learning selection/error layer otherwise has no way out. This preserves the mobile height improvement and required auxiliary access.
