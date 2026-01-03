/**
 * Example: How to integrate RankingEditor into your app
 * This demonstrates the new Remotion-based editor
 */

import { RankingEditor } from "./features/ranking/components/RankingEditor";

// Simple integration - just render the component
export function App() {
  return <RankingEditor />;
}

// Or integrate into existing router
import { createRoute } from "@tanstack/react-router";

export const remotionEditorRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/remotion-editor",
  component: RankingEditor,
});

// Usage notes:
// 1. The RankingEditor is a complete standalone component
// 2. State is managed internally via useCompositionState hook
// 3. Preview uses Remotion Player for real-time rendering
// 4. Export functionality requires server-side Remotion renderer (Phase 4)
