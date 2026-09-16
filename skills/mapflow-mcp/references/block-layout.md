# MapFlow block layout reference

## Data shape

`mapflow.get_tree` returns:

- `blocks`: `{ id, name, color, sortOrder }[]`
- `nodes[*].blockId`: a block id or `null`
- `tree.layoutMode`: `auto` or `manual` coordinate-writing intent

`tree.layoutMode` is separate from the two frontend display layouts. Do not use it to request block layout.

## Two fixed layouts

### Relationship layout

This is the default view. The frontend computes positions from the directed dependency graph and learning depth. MCP-supplied coordinates and `orderInLevel` are not a free-form canvas API and cannot force another visual arrangement.

### Block layout

The frontend groups nodes by their valid `blockId` assignments. Blocks are ordered by `sortOrder`; ties are stable by block id. Within each block, the same dependency layout is used. Nodes without a valid assignment are kept in a final unassigned lane, so adding blocks never hides content.

The switch is available only when at least one block and one valid node assignment exist. Existing trees without this metadata remain valid and continue to use relationship layout.

## Creating a tree with blocks

`mapflow.create_tree` accepts optional block metadata:

```json
{
  "blocks": [
    {
      "id": "22222222-2222-4222-8222-222222222222",
      "name": "基础能力",
      "color": "#22d3ee",
      "sortOrder": 0
    }
  ],
  "nodes": [
    {
      "id": "root",
      "title": "运行时基础",
      "category": "foundation",
      "blockId": "22222222-2222-4222-8222-222222222222"
    }
  ]
}
```

The fields are optional so older clients remain compatible. If omitted, the tree is relationship-layout-only until blocks are added with `mapflow.apply_tree_mutation`.

## Editing an existing tree

Use `add_block` to create a block, reread the tree to obtain its generated id, then use `set_node_block` for each node. Use `null` as `blockId` to remove a node from a block. Keep one node in at most one block. Block operations do not change completion state or the dependency edges.
