---
name: mapflow
description: Connect a local Agent to a user's MapFlow account to read learning progress, create or extend learning maps, and update node layout through MapFlow MCP tools. Use for online account operations; offline SKILL_TREE.json generation belongs to skill-tree-generator.
metadata:
  short-description: Connect an Agent to MapFlow learning maps
---

# MapFlow Agent

Use this skill when the user wants an Agent to work with the MapFlow account behind the website: inspect personal learning trees, create a new map, add a missing learning shape, or arrange an existing tree. The Skill supplies the workflow; the MCP connection supplies the authenticated tools. A local JSON file is not a saved MapFlow tree.

## Task contract

- WHAT: name the requested online effect first — inspect progress, create a map, add a learning shape, or change visual layout.
- WHERE: establish the authenticated account and the exact private tree/libraryEntryId before reading or writing it.
- DONE: report the actual tool result, affected ids, and latest revision; for a new map, tell the user where to find its title in the MapFlow console.
- HOW: let the user choose the learning approach and level of detail. Offer an explanation or comparison when useful, and ask only for a missing premise that changes the result.

## Shared norms

- Confirm the account scope with the MCP tool mapflow.whoami before account work; do not substitute a shell whoami command. Never ask the user to paste a token into chat and never expose a token in output, logs, examples, or an audit summary. First-time device authorization is handled by the connector and its browser flow.
- Use the MCP tool mapflow.get_progress to choose a target libraryEntryId. At the start of an edit session and after a conflict, call mapflow.get_tree for that entry. Use the latest revision from that read or from the preceding successful mutation; do not infer an entry id from a title or use a stale snapshot.
- Mutation patches use camelCase. MapFlow node fields returned by get_tree use the server's snake_case shape; tree.layoutMode is the MCP response field. Do not silently translate a response field into a write field without checking the relevant reference or tool schema.
- On mutation.revision_conflict, discard the stale command plan, read the current tree again, and recompute the requested change against the new graph. Do not blindly retry the same payload. Reuse an idempotency key only when retrying the same logical request after an uncertain transport result.
- Ordinary, explicitly requested writes do not need a chain of extra approvals. Ask only when the target, account, or scope is genuinely ambiguous. Before deletion, clearing, or overwriting existing content, state the exact scope and obtain the user's explicit decision unless the user has already authorized that exact scope; do not ask again for an existing authorization.
- Keep learning semantics separate from visual layout. Moving a node does not change its prerequisite meaning; adding a node does not mark it learned. Existing code, a generated plan, or a completed Agent step is not evidence that the user mastered the node.
- If a requested tool is absent from tools/list, report that the connected server or relay must be updated. Do not emulate a successful write with a local file or claim that the website changed.

## Progressive router

Read only the reference needed for the current request. Load more than one when the request genuinely crosses modes.

- Connection, Skill installation, MCP setup, first authorization, or token handling → [references/connection.md](references/connection.md).
- Creating a new map, supplying the complete graph, or adding missing nodes and edges → [references/create-tree.md](references/create-tree.md). Add [references/learning-semantics.md](references/learning-semantics.md) when the request needs help deciding what a node or dependency should mean.
- Rearranging nodes, changing coordinates, switching automatic/manual layout, or repairing a partially applied layout → [references/update-layout.md](references/update-layout.md).
- Questions about learning goals, evidence, progress, prerequisites, or whether a user has learned something → [references/learning-semantics.md](references/learning-semantics.md).

Natural follow-up questions, explanations, and comparisons are part of the work when they help the user decide. They do not automatically require a write. If the direction is clear, act; ask only for a missing prerequisite that changes the result.

## Completion report

After a successful operation, report what changed, the relevant libraryEntryId/node ids when useful, and the returned revision. For a newly created map, direct the user to open the MapFlow console and find it under “我的学习” by title; do not invent a tree URL. If the service or relay is unavailable, name the missing capability and the next connection/update needed.
