# Learning semantics for MapFlow work

MapFlow is a learning aid. The Agent can help turn a direction into a useful graph, but it must not pretend that a graph or code artifact proves mastery.

## Decide what belongs in the map

Start from the user's desired outcome, current context, and constraints when those details matter. A node can name a learning concept or capability, have a reason to exist, and connect to prerequisites that the user can understand. Use evidence to describe what could be observed later; a title does not need to be phrased as an action. Use an edge as a learning dependency, not as a decorative line. Keep the graph acyclic and avoid adding duplicate nodes merely to fill a target count.

The user decides the desired level of detail. Do not impose a fixed 30–80 node range, require every node to be reviewed before action, or require every node to be completed before the Agent can add another. If direction is clear, use a reasonable scope and mention assumptions briefly.

Natural explanations, comparisons, and follow-up questions are valid outcomes even when no tree write is needed. Ask a focused question only when its answer changes the graph or target account.

## Evidence and progress

Use evidence that a third party could inspect: an explanation in the user's own words, a small implementation, a test or request result, a diagram, a comparison, or a diagnosis of a failure. Choose evidence that fits the user's goal; it is guidance, not a mandatory template.

Do not mark a node complete because the Agent generated text, the project contains related code, or a command ran successfully. A generated map is a plan. A node's completion belongs to the user's actual progress and should remain untouched while creating, adding, or rearranging nodes unless the user explicitly asks for a separate progress action and the connected tool supports it.

## Adding or changing concepts

Before adding a node, inspect the existing graph and completed ids. Preserve an existing node when it already expresses the same capability. Add a new node when the user needs a distinct concept, context, or dependency; then add only the prerequisite edges required by that meaning.

Keep a visual move separate from a semantic change:

- positionX, positionY, and orderInLevel express placement.
- depthLevel, titles, node descriptions, and edges express learning structure.
- layoutMode controls whether the site treats placement as automatic or manual.

If the user says “整理顺序” and it could mean either canvas order or study prerequisites, ask which meaning they intend. If they clearly mean the canvas, route to update-layout.md; if they mean learning dependencies, use the graph workflow in create-tree.md.
