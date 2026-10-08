# Learning-area selection page slice

Implement the full selection layer before integrating it into four-page navigation. Approved design: one owned map per area, no map generation or model request on entering/joining; archived placeholders remain visible. Existing maps come from the compact personal-library endpoint.

1. Write user-visible tests for listing/searching areas, creating from an existing map, opening an area, unavailable maps, failures and no-map guidance; run RED for the missing page.
2. Implement `LearningAreaSelector` with account-scoped query keys and explicit callback navigation. Create uses CSRF and preserves selection on failure. No tree detail, conversation creation or model request here.
3. Run focused tests, full frontend checks and review diff. Use the selector from the learning-chat page in the next UI slice; manager callback belongs to that parent page.

Files: new `src/features/learning/LearningAreaSelector.tsx` and `.test.tsx`; existing client scene metadata is covered by `learningAreas.test.ts`.
