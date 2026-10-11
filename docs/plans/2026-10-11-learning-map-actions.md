# Learning map actions and safe navigation

Approved four-interface design, continuing after merging the user's mobile changes.

1. Personal-map search filters the visible owned directory without loading other maps or changing selection. Verify matching, clearing, and retaining the selected map.
2. Node-to-learning entry uses one in-flight operation and ignores stale navigation after leaving its originating view/account/map. Verify rapid duplicate clicks and delayed responses after navigating elsewhere.
3. The lazily opened learning map restores its node selection, offers existing node details/progress/notes, and stages a removable reference without sending a message. Reuse existing authenticated endpoints and query keys. Verify explicit saves, target IDs, collapse/reopen and no automatic generation.
4. A note cannot be dismissed while its save/delete is pending; conflicts retain the user's draft. Consumed/removed node references also leave the URL so they cannot reappear on refresh. Verify delayed saves, conflicts and removal followed by navigation.
5. Run focused RED → GREEN, complete frontend tests/types/build, review the diff and commit evidence. Actual browser/paid acceptance remains the final integration gate.
