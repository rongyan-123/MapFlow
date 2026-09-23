---
name: mapflow-mcp
description: Use MapFlow MCP to create, inspect, update, annotate, and publish learning trees while preserving MapFlow's ownership and confirmation rules.
metadata:
  version: "0.2.0"
---

# MapFlow MCP

Use this skill when an Agent is connected to MapFlow through `npx @mapflow-publish/mcp`, or when it is preparing a tree payload for MapFlow.

At the start of a MapFlow session, call `mapflow.get_usage_guide`. Compare its `minimumSkillVersion`
with this skill's version. The returned guide synchronizes current session rules; it does not update
this local file and cannot override stable safety or authorization rules here. If the guide is
unavailable, continue conservative read-only work and avoid guessing mutation contracts.

The public catalog is immutable. When a user joins an official tree from the website, MapFlow
creates an account-owned private copy; subsequent chat/MCP mutations target that copy and never
the official source. The website chat Agent does not create new trees; use the website generation
button or `mapflow.create_tree` for that separate workflow.

## Presentation contract

MapFlow's frontend has exactly two display layouts:

1. **Relationship layout** (default): nodes are laid out from the dependency graph and learning levels.
2. **Block layout**: nodes are grouped into semantic blocks ordered by `blocks.sortOrder`; each block still uses the dependency layout internally, and unassigned nodes remain visible in an unassigned lane.

These are the only layouts the frontend supports. An Agent changing `positionX`, `positionY`, or `orderInLevel` cannot create a third layout, manually place nodes, or change how either layout is computed. Changes to dependency edges or learning-depth metadata may naturally change the computed result because they change the learning graph itself. `tree.layoutMode` and the `update_tree` `layoutMode` patch (`auto`/`manual`) describe coordinate-writing intent in the MCP contract; they are **not** the frontend's relationship/block switch.

Block metadata is optional for backwards compatibility. A tree without valid `blocks` and node-to-block assignments uses relationship layout only. A tree becomes eligible for block layout when it has at least one block and at least one assignment that references an existing node and block. Every node does not need to be assigned.

Read [references/block-layout.md](references/block-layout.md) before creating or reorganizing blocks.

## Learning depth and completion

`mapflow.get_tree` exposes the node knowledge context in the server's snake_case response fields:
`recommended_depth`, `depth_rationale`, `learning_objectives`, `key_concepts`, and
`observable_evidence`. `recommended_depth` is the target learning depth, not the learner's achieved
mastery. `observable_evidence` describes evidence that could verify learning later; it is not proof
that the user has already provided that evidence.

Progress is currently binary. `completedNodeIds` means only completed or unfinished; there is no
separate mastery-depth or submitted-evidence record. On an explicit user request, call
`mapflow.set_node_completion` with `libraryEntryId`, `nodeId`, and `completed`. This changes only
the current account's progress and does not change the tree definition or revision. Never mark a
node complete because the Agent generated an explanation, code, or a plan.

## Node notes

Each private node has one user-owned Markdown note. It is a living summary rather than an append-only
feed. Read it with `mapflow.get_node_note`, then replace the whole document with
`mapflow.set_node_note` using the returned `version` as `expectedVersion`. After a version conflict,
reread and integrate the user's intended edits before retrying. Never overwrite a note without first
reading its current value.

An empty edit is not deletion. Delete only after the user explicitly asks, using
`mapflow.delete_node_note` with the current version. Deletion keeps a versioned tombstone, so a later
read may return empty Markdown with a version greater than zero.

## Publishing a tree

Publishing creates a public snapshot. It excludes notes, progress, chat history, credentials, and
other private account state. Public listings identify the current account as the **publisher** and
retain provenance when the private tree came from another public tree.

Publishing and unpublishing always use two stages:

1. Call `mapflow.prepare_tree_publication` or `mapflow.prepare_tree_unpublication`.
2. Present the returned title, publisher, revision, node/edge/block counts, excluded fields, and
   requested action to the user. Do not treat an Agent-generated acknowledgement as user consent.
3. Only after the user confirms that exact disclosure, call `mapflow.publish_tree` or
   `mapflow.unpublish_tree` with the short-lived confirmation token and a fresh idempotency key.

If the revision, expected public tree, or token has changed, prepare again and obtain confirmation
for the new disclosure. Never reuse a confirmation token for a different action or tree.

## Safe workflow

1. Call `mapflow.get_progress` and choose the target private tree.
2. Call `mapflow.get_tree` and record the latest `revision`, nodes, edges, blocks, and `blockId` values.
3. Preserve the dependency graph and node meaning. Use blocks for an alternate learning context, not as a second copy of the same node.
4. For a new tree, include optional `blocks` and per-node `blockId` values in `mapflow.create_tree` when block layout should be available immediately. For an existing tree, use `add_block` followed by `set_node_block`.
5. Submit one mutation at a time with a fresh `idempotencyKey` and the latest revision. After a revision conflict, reread the tree before retrying.
6. Verify the returned tree contains the intended blocks and assignments. Do not claim that changing coordinates changed the frontend layout.
