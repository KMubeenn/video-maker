import { Outlet, useRouter } from "@tanstack/react-router";
import { useAuth } from "../hooks/useAuth";
import { Navigation } from "../components/Navigation";
import { useEffect } from "react";

export function RootLayout() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      const currentPath = window.location.pathname;
      if (!user && currentPath !== "/login" && currentPath !== "/signup") {
        router.navigate({ to: "/login" });
      } else if (user && (currentPath === "/login" || currentPath === "/signup")) {
        router.navigate({ to: "/videos" });
      }
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh", flexDirection: "column", gap: "10px" }}>
        <div>Loading...</div>
        <div style={{ fontSize: "12px", color: "#666" }}>Checking authentication...</div>
        <div style={{ fontSize: "10px", color: "#999", marginTop: "10px" }}>
          If this takes too long, check the browser console for errors
        </div>
      </div>
    );
  }

  return (
    <div>
      {user && <Navigation />}
      <main>
        <Outlet />
      </main>
    </div>
  );
}

