# Shared roles and independent history selection

Approved continuation of the four-interface design. No deployment in this stage.

1. RED → GREEN: history initially includes every role in the current scene/area; its role filter does not change the active conversation, role, draft or request. Keep the active conversation selectable even when a filter excludes it.
2. RED → GREEN: import/create adds a shared library item and an explicit Use action, preserves the current conversation and unsent draft, and records an account-scoped unread count. Opening the role selector clears the count; failed imports do not increment it.
3. RED → GREEN: explicit role selection changes the current conversation role through the versioned endpoint, keeping title/history. Without an active story, prepare a role selection; New conversation is the explicit creation action. No implicit recent-story lookup by role.
4. RED → GREEN: parse and render persisted anchored role changes on the corresponding history path without placing UI events in model messages. Old responses without events remain compatible; malformed events are rejected.
5. Preserve hidden-card history, editing snapshots, disabled tools, mobile compact menus and pending-creation retry locks. Run the complete frontend suite, typecheck/build and review the diff before committing. Backend role changes already persist under scene/account isolation.

Ruling: role selection in all three chat scenes uses the same explicit current-conversation behavior. The initial independent tavern still requires a selected/imported role; the approved design only promises default assistants for learning and management. Cost if incorrect: an additional independent default role, without migrating existing histories.
