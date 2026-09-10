# Create or extend a MapFlow learning map

Use this reference for a new map or for adding a missing node/edge to an existing private map. Read the learning guidance as well when the user has not decided what the new learning shape should represent.

## Before writing

For account work, call `mapflow.whoami`, then `mapflow.get_progress`. For an existing map, select its `libraryEntryId` and call `mapflow.get_tree` at the start of the edit session before planning mutations. Keep the returned revision and the current nodes/edges together; titles alone are not a safe target. After each successful mutation, use its returned revision for the next command; reread after a conflict.

Direction is enough to start. Do not force a fixed node count, require approval of every intermediate node, or make the user prove every node before the map can be created. Ask only for a missing premise that changes the graph, such as an unclear target outcome or an ambiguous existing tree.

## `mapflow.create_tree`

When `tools/list` exposes this tool, send one complete graph request. This three-node request is a small executable example; its ids and values satisfy the current server limits:

~~~json
{
  "tree": {
    "topic": "rust-agent-basics",
    "title": "Rust Agent 基础",
    "description": "从所有权到可测试 Agent 组件",
    "difficultyLevel": "beginner",
    "layoutMode": "manual"
  },
  "nodes": [
    {
      "id": "ownership",
      "title": "Ownership",
      "description": "Rust 的所有权与移动语义",
      "icon": "book",
      "category": "foundation",
      "difficulty": 2,
      "estimatedMinutes": 45,
      "depthLevel": 0,
      "positionX": 0,
      "positionY": 0,
      "orderInLevel": 0,
      "learningObjectives": ["解释 move 与 borrow 的关系"],
      "keyConcepts": ["move", "borrow"],
      "recommendedDepth": "Understand",
      "depthRationale": "先建立所有权模型，再进入异步组件。",
      "observableEvidence": ["用自己的话解释一个值何时发生 move。"]
    },
    {
      "id": "borrowing",
      "title": "Borrowing",
      "description": "引用、生命周期与可变借用",
      "icon": "link",
      "category": "foundation",
      "difficulty": 3,
      "estimatedMinutes": 50,
      "depthLevel": 1,
      "positionX": 240,
      "positionY": 0,
      "orderInLevel": 0,
      "learningObjectives": ["区分共享引用和可变引用"],
      "keyConcepts": ["reference", "lifetime"],
      "recommendedDepth": "Use",
      "depthRationale": "需要能在短代码片段中选择合适的借用方式。",
      "observableEvidence": ["修正一个借用检查器报错并说明原因。"]
    },
    {
      "id": "testing",
      "title": "Agent 测试",
      "description": "为 Agent 组件建立可重复的测试边界",
      "icon": "check",
      "category": "practice",
      "difficulty": 4,
      "estimatedMinutes": 60,
      "depthLevel": 2,
      "positionX": 480,
      "positionY": 0,
      "orderInLevel": 0,
      "learningObjectives": ["为一个 Agent 边界编写可重复测试"],
      "keyConcepts": ["fixture", "assertion"],
      "recommendedDepth": "Use",
      "depthRationale": "把前置语言概念用于一个可验证的组件边界。",
      "observableEvidence": ["运行测试并解释一次失败断言。"]
    }
  ],
  "edges": [
    {
      "id": "ownership-borrowing",
      "sourceNodeId": "ownership",
      "targetNodeId": "borrowing",
      "edgeType": "prerequisite",
      "label": "先理解所有权"
    },
    {
      "id": "borrowing-testing",
      "sourceNodeId": "borrowing",
      "targetNodeId": "testing",
      "edgeType": "prerequisite",
      "label": "再建立测试边界"
    }
  ],
  "idempotencyKey": "rust-agent-basics-20260909"
}
~~~

The current contract requires `tree.topic`, `tree.title`, `tree.difficultyLevel`, and `tree.layoutMode`; `layoutMode` is exactly `auto` or `manual`. Tree topic/title are 1–240 characters and description is at most 4,000 characters. `difficultyLevel` is non-empty text up to 40 characters, with no server enum; values such as `beginner`, `intermediate`, and `advanced` are conventions.

Each node requires a non-empty `id`, `title`, and `category`. Node ids and titles are at most 240 characters; node descriptions are at most 8,000, category is at most 120, and icon at most 80. Node ids only need to be unique within this graph; they do not need to be UUIDs. The server defaults omitted `icon` to `circle`, `difficulty`, `estimatedMinutes`, `depthLevel`, `positionX`, `positionY`, and `orderInLevel` to zero, `recommendedDepth` to `Understand`, and evidence to an empty value. Explicit numeric values must satisfy difficulty 0–10, estimated minutes/depth/order non-negative, and finite coordinates with absolute value at most 1,000,000. `recommendedDepth` is exactly one of `Recognize`, `Understand`, `Use`, `Transfer`, or `DeepMastery`.

`learningObjectives`, `keyConcepts`, and `observableEvidence` are accepted as `string[]` (a legal JSON-array string is also compatible at creation). The server normalizes them into its existing JSON-text storage. `depthRationale` is at most 8,000 characters and evidence storage is at most 16,000 characters. Edges are optional, capped at 2,000, and each edge id, source node id, and target node id must be non-empty and at most 240 characters. `edgeType` is non-empty text up to 80 characters, with no server enum; `prerequisite` is a useful convention. Edge endpoints must exist in `nodes`, and the graph must remain acyclic.

Creation is private to the authenticated account and starts `ready`. For `manual`, provide meaningful coordinates and `orderInLevel`; for `auto`, the site layout engine is authoritative. The server does not infer layout intent from zero coordinates.

On success the response is:

~~~json
{
  "libraryEntryId": "<private tree library entry>",
  "treeId": "<tree id>",
  "revision": 1,
  "layoutMode": "manual"
}
~~~

Use the returned `libraryEntryId` for follow-up reads and writes. The response does not establish a public URL; tell the user to open the MapFlow console and find the title under “我的学习”. The server generates the tree/library UUIDs; the request's node and edge ids remain the supplied strings.

The `idempotencyKey` is account-scoped, non-empty, and at most 128 characters. If transport fails after submission, retry the same payload with the same key. The same key and normalized payload returns the original creation receipt; reusing it with a different payload yields `create.idempotency_conflict`. Do not generate a second tree just because the first response was delayed.

## Add a missing node, dependency, and layout adjustment

After the example above returns its `libraryEntryId` at revision 1, the following sequence adds a fourth node, links it, and moves it on the manual canvas. Replace only `libraryEntryId` with the exact UUID returned by the create call; do not infer it from the title. Each response supplies the next revision.

1. Add a node. `learningObjectives` and `keyConcepts` are supported here as JSON arrays; `observableEvidence` is the legacy string field, so send its JSON encoding as a string. The current `update_node` implementation updates only `title`, `description`, `category`, `difficulty`, `estimatedMinutes`, `depthLevel`, `recommendedDepth`, `depthRationale`, `observableEvidence`, `positionX`, `positionY`, and `orderInLevel`. Do not send `icon`, `learningObjectives`, or `keyConcepts` to `update_node`; those keys are currently ignored.

~~~json
{
  "libraryEntryId": "<libraryEntryId returned above>",
  "mutation": {
    "operation": "add_node",
    "targetId": "error-handling",
    "revision": 1,
    "idempotencyKey": "add-error-handling-20260909",
    "patch": {
      "title": "错误处理",
      "category": "practice",
      "description": "Result、错误传播与测试分支",
      "icon": "alert",
      "difficulty": 4,
      "estimatedMinutes": 45,
      "depthLevel": 2,
      "positionX": 720,
      "positionY": 0,
      "orderInLevel": 1,
      "learningObjectives": ["区分可恢复错误和失败路径"],
      "keyConcepts": ["Result", "error propagation"],
      "recommendedDepth": "Use",
      "depthRationale": "把测试边界扩展到可解释的失败路径。",
      "observableEvidence": "[\"运行一个失败用例并解释错误来源。\"]"
    }
  }
}
~~~

2. Add the dependency using the revision returned by step 1 (revision 2 in a clean run):

~~~json
{
  "libraryEntryId": "<same libraryEntryId>",
  "mutation": {
    "operation": "add_edge",
    "targetId": "testing-error-handling",
    "revision": 2,
    "idempotencyKey": "add-testing-error-edge-20260909",
    "patch": {
      "sourceNodeId": "testing",
      "targetNodeId": "error-handling",
      "edgeType": "prerequisite",
      "label": "先有测试边界"
    }
  }
}
~~~

3. Move the new node with `update_node` using the revision returned by step 2 (revision 3 in a clean run). This is a visual change; it does not alter the prerequisite graph:

~~~json
{
  "libraryEntryId": "<same libraryEntryId>",
  "mutation": {
    "operation": "update_node",
    "targetId": "error-handling",
    "revision": 3,
    "idempotencyKey": "layout-error-handling-20260909",
    "patch": {
      "positionX": 720,
      "positionY": 180,
      "orderInLevel": 0
    }
  }
}
~~~

If a tree is currently `auto`, first use `update_tree` with its current revision and `{ "layoutMode": "manual" }`, then update node coordinates with the returned revision. If any step reports `revision_conflict`, call `mapflow.get_tree`, compare the current graph with the intended change, and recompute the remaining mutations with fresh revisions and idempotency keys. Do not blindly replay the stale sequence.

If the requested concept already exists, preserve the existing node and explain the overlap. Add a new node when the user needs a distinct learning shape or dependency; do not silently rewrite an existing title to mean something else.

If `mapflow.create_tree` is missing, report that the connected server/relay has not been updated. Do not fall back to writing `SKILL_TREE.json` and call that a website save.
