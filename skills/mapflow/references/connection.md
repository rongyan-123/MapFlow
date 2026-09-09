# MapFlow connection and installation

There are two separate pieces:

1. The mapflow Skill teaches the Agent how to reason about MapFlow work.
2. The MapFlow MCP connection exposes account-scoped tools such as mapflow.whoami, mapflow.get_progress, mapflow.get_tree, and mapflow.apply_tree_mutation; mapflow.create_tree is available when the connected server advertises it.

Installing one does not install the other. A local Skill folder cannot save data to the website, and an MCP connection without this workflow does not decide which tree or learning meaning is appropriate.

## MCP connection

The npm relay package is published as @mapflow-publish/mcp (currently latest 0.1.0). Configure the host with the command that its local help confirms:

~~~
Codex:       codex mcp add mapflow -- npx -y @mapflow-publish/mcp
Claude Code: claude mcp add --transport stdio mapflow -- npx -y @mapflow-publish/mcp
~~~

The first run may open MapFlow's device authorization page. Let the connector guide the browser flow and then call mapflow.whoami; do not read, request, or paste the token. The relay stores the local credential according to its own instructions; the Skill does not inspect that file.

If the command or package is unavailable, say that the MCP connection is not ready and stop the account operation. If the connection starts but a requested tool is absent from tools/list, report that the connected server does not provide that capability yet. Do not substitute a guessed package name, a local JSON export, or an HTTP call that bypasses the connector.

## Skill distribution

For a local checkout, use the host's documented local Skill discovery/install flow and point it at skills/mapflow/. Verify the Skill is discoverable in an isolated test directory when packaging it; do not write a user's global Agent configuration as part of that check.

For the public release, use the current “使用 MapFlow 接入 Skill” section in the repository README. That section is the source of truth for the locked commit and the complete Codex/Claude Code `npx skills add` commands. This Skill reference intentionally does not duplicate a commit URL, so an installed Skill cannot direct the Agent to an older release.

If a remote install fails, check the requested repository revision and package discovery result before reporting success or asking the user to retry. The current repository publication status belongs in the project README and onboarding plan.

## First account pass

After the MCP connection is ready:

1. Call the MCP tool mapflow.whoami and confirm the account/label is the intended one; this is not a shell whoami command.
2. Call the MCP tool mapflow.get_progress to discover the user's private trees.
3. Select the requested libraryEntryId from that response; do not ask for or expose a token to identify it.

The connector's authorization is an account boundary, not permission to change every tree. Mutations still target the selected private entry and must follow the revision workflow in update-layout.md or create-tree.md.
