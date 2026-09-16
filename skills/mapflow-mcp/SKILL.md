---
name: mapflow-mcp
description: Use MapFlow MCP to create, inspect, and update a private learning tree while preserving MapFlow's fixed two-layout presentation contract.
---

# MapFlow MCP

Use this skill when an Agent is connected to MapFlow through `npx @mapflow-publish/mcp`, or when it is preparing a tree payload for MapFlow.

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

## Safe workflow

1. Call `mapflow.get_progress` and choose the target private tree.
2. Call `mapflow.get_tree` and record the latest `revision`, nodes, edges, blocks, and `blockId` values.
3. Preserve the dependency graph and node meaning. Use blocks for an alternate learning context, not as a second copy of the same node.
4. For a new tree, include optional `blocks` and per-node `blockId` values in `mapflow.create_tree` when block layout should be available immediately. For an existing tree, use `add_block` followed by `set_node_block`.
5. Submit one mutation at a time with a fresh `idempotencyKey` and the latest revision. After a revision conflict, reread the tree before retrying.
6. Verify the returned tree contains the intended blocks and assignments. Do not claim that changing coordinates changed the frontend layout.
