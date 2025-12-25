import { Outlet, useRouter } from "@tanstack/react-router";
import { useAuth } from "../hooks/useAuth";
import { Navigation } from "../components/Navigation";
import { useEffect } from "react";
import { Skeleton } from "@/components/ui/skeleton";

export function RootLayout() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      const currentPath = window.location.pathname;
      if (!user && currentPath !== "/login" && currentPath !== "/signup") {
        router.navigate({ to: "/login" });
      } else if (
        user &&
        (currentPath === "/login" || currentPath === "/signup")
      ) {
        router.navigate({ to: "/videos" });
      }
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background">
        <div className="flex flex-col items-center gap-2">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-4 w-48" />
        </div>
        <p className="text-sm text-muted-foreground">
          Checking authentication...
        </p>
        <p className="text-xs text-muted-foreground">
          If this takes too long, check the browser console for errors
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {user && <Navigation />}
      <main className="container mx-auto py-6">
        <Outlet />
      </main>
    </div>
  );
}
