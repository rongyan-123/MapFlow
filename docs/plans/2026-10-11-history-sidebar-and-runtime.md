# Scene history and navigation-safe generation

Authority: approved four-interface design and the user's request to continue implementation with the latest mobile frontend commits.

1. Put the current scene/area's history in a visible left sidebar. Keep the all-role filter separate from the explicit active-role selector. Mobile history uses a drawer. Verify user-visible filtering, opening a story, scene isolation and existing mobile entry tests; no hidden role switch or auto-generation.
2. Move the running request/controller and streamed presentation state above individual visible chat mounts. Bind it to account/scene/area/conversation/branch/action. Verify leaving and reopening while a real streamed response is in flight does not abort, duplicate a request, lose its owner or show it in another chat. Stop and logout still fence the request.
3. Complete full frontend tests/types/build and self-review. Real browser and charged API acceptance remain the integrated final gate. Deployment is not authorized by this implementation checkpoint.

Ruling: existing shared model/role/conversation and payment storage are reused; there is no new chat database and no new concurrency cap. Navigation releases heavy editors while the owned run can continue.
