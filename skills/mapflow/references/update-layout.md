# Update MapFlow layout safely

Use this reference for visual arrangement, coordinate changes, or switching between automatic and manual layout on an existing private tree.

## Read the current graph

Call mapflow.whoami when the connection/account is not already confirmed, then mapflow.get_progress and mapflow.get_tree for the chosen libraryEntryId. The get_tree response includes the current tree revision, tree.layoutMode, nodes, edges, and completion ids. Node response fields are snake_case (for example position_x, position_y, and order_in_level); mutation patch fields are camelCase.

Keep the graph and revision from the same read. A title match or a cached coordinate list is insufficient.

## Choose the layout mode

- auto delegates visual placement to the site's automatic layout. Use mapflow.apply_tree_mutation with operation: update_tree, the current revision, and a patch such as { "layoutMode": "auto" }.
- manual makes stored node coordinates and within-level order meaningful. First set { "layoutMode": "manual" } with update_tree, then update nodes with update_node patches containing positionX, positionY, and/or orderInLevel as needed.

update_tree patches preserve the other tree metadata. An update_node patch can also contain other supported node fields; use the live tool schema and the existing node's style for those fields. Do not send snake_case keys in a mutation patch.

Each call to mapflow.apply_tree_mutation is one versioned write. If several nodes must move, submit one mutation per node using the revision returned by the previous call, or make a smaller plan that the user can inspect. Do not claim a multi-call layout change was atomic.

## Revision conflicts

On mutation.revision_conflict:

1. Call mapflow.get_tree again for the same libraryEntryId.
2. Compare the current coordinates, mode, edges, and any changed titles with the requested layout intent.
3. Recompute only the still-needed mutations using the new revision and fresh idempotency keys.
4. Report any choice that became ambiguous because another change moved or renamed the target.

Never loop on the same stale revision and never overwrite a concurrent edit merely to make the old plan pass.

Changing layout is a visual edit. If the user actually wants a different learning order or prerequisite, explain that this requires node/edge semantics and route through create-tree.md and learning-semantics.md. Before deleting, clearing, or replacing existing nodes, state the exact affected ids and wait for explicit scope when it is not already clear; an existing authorization for that exact scope is sufficient.
