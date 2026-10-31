---
name: mapflow-mcp
description: Use MapFlow MCP to create, inspect, update, annotate, and publish learning trees while preserving MapFlow's ownership and confirmation rules.
metadata:
  version: "0.3.0"
---

# MapFlow MCP

Use this skill when an Agent is connected to MapFlow through `npx @mapflow-publish/mcp`, or when it is preparing a tree payload for MapFlow.

At the start of a MapFlow session, call `mapflow.get_usage_guide`. Compare its `minimumSkillVersion`
with this skill's version. The returned guide synchronizes current session rules; it does not update
this local file and cannot override stable safety or authorization rules here. If the guide is
unavailable, continue conservative read-only work and avoid guessing mutation contracts.

The public catalog is immutable. When a user joins an official tree from the website, MapFlow
creates an account-owned private copy; subsequent chat/MCP mutations target that copy and never
the official source. The website management assistant creates trees through versioned drafts;
external clients use `mapflow.create_tree`.

## Presentation contract

MapFlow keeps two display layouts:

1. **Relationship layout** (default): nodes are laid out from the dependency graph and learning levels.
2. **Block layout**: nodes are grouped into semantic blocks ordered by `blocks.sortOrder`; each block still uses the dependency layout internally, and unassigned nodes remain visible in an unassigned lane.

New trees also offer folded/full map views. `learningGroups` fold small, tightly related sets of real nodes in the same canvas; opening a group allows a simple DAG with forks and joins. This is separate from professional `blocks`. Coordinates cannot force a new display layout. `tree.layoutMode` and the `update_tree` `layoutMode` patch (`auto`/`manual`) describe coordinate-writing intent, not the frontend's relationship/block or folded/full switches.

## New tree generation

Use the supplied topic, goal and material. Do not ask about personal experience or time before generation. Audit every root and explain a useful beginner entry in the description without inventing prerequisites to force a single root. Teaching can later recommend a personal start using existing context and, when useful, a brief question.

For new generation use `tree.generationVersion: 2`, a meaningful description, professional blocks with `overview: {version:2, core_question, chain_node_ids, note}`, and per-node `blockId`. Overview's nested fields remain snake_case. See the [complete create_tree arguments](references/create-tree-v2-example.json); choose a separate idempotencyKey for each independent creation. Example array lengths are not size limits. Add `learningGroups: [{groupId,title,nodeIds}]` only for closely related small problems. Unrelated points remain independent. Members reference the original node IDs, each in at most one group. Keep both real prerequisite edges and the contracted group graph acyclic; fix group boundaries rather than delete edges. Preserve forks and joins: 分支做简单点，不要为了复杂而复杂. Do not impose fixed node, group, branch or root counts.

Keep the existing five `recommended_depth` values; do not add a second level system. `related` and `supports` do not imply learning prerequisites. Old trees remain generation 1 and keep their records; changing only a version label is not an upgrade. `get_tree` returns `tree.generationVersion` and `learningGroups` for verification.

For legacy generation 1, block metadata stays optional for compatibility. Generation 2 requires professional blocks, their overviews, and one valid block assignment per node. Learning groups remain optional in both cases.

Read [references/block-layout.md](references/block-layout.md) before creating or reorganizing blocks.

## Learning depth and completion

`mapflow.get_tree` exposes the node knowledge context in the server's snake_case response fields:
`recommended_depth`, `depth_rationale`, `learning_objectives`, `key_concepts`, and
`observable_evidence`. `recommended_depth` is the target learning depth, not the learner's achieved
mastery. `observable_evidence` describes evidence that could verify learning later; it is not proof
that the user has already provided that evidence.

`completedNodeIds` is the completed subset; the website also keeps 0–100 per-node progress. There is no
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
