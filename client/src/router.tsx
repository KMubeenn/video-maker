import {
  createRouter,
  createRootRoute,
  createRoute,
} from "@tanstack/react-router";
import { RootLayout } from "./routes/__root";
import { LoginPage } from "./routes/login";
import { SignupPage } from "./routes/signup";
import { VideosPage } from "./routes/videos";
import { TeamsPage } from "./routes/teams";
import { AdminPage } from "./routes/admin";
import { RankingPage } from "./routes/ranking";
import { MergePage } from "./routes/merge";
import { IndexPage } from "./routes/index";
import { AssetsPage } from "./pages/AssetsPage";

// Root route
const rootRoute = createRootRoute({
  component: RootLayout,
});

// Index route
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: IndexPage,
});

// Auth routes
const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/login",
  component: LoginPage,
});

const signupRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/signup",
  component: SignupPage,
});

// Protected routes
const videosRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/videos",
  component: VideosPage,
});

const teamsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/teams",
  component: TeamsPage,
});

const adminRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/admin",
  component: AdminPage,
});

const rankingRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/ranking",
  component: RankingPage,
});

const assetsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/assets",
  component: () => <AssetsPage />,
});

const mergeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/merge",
  component: MergePage,
});

// Create the route tree
const routeTree = rootRoute.addChildren([
  indexRoute,
  loginRoute,
  signupRoute,
  videosRoute,
  teamsRoute,
  adminRoute,
  rankingRoute,
  mergeRoute,
  assetsRoute,
]);

// Create the router
export const router = createRouter({ routeTree });

// Register the router instance for type safety
declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
