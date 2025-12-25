import { Link, useNavigate } from "@tanstack/react-router";
import { useAuth } from "../hooks/useAuth";

export function Navigation() {
  const { user, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate({ to: "/login" });
  };

  return (
    <nav
      style={{
        backgroundColor: "#333",
        color: "white",
        padding: "1rem",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
      }}
    >
      <div style={{ display: "flex", gap: "1rem" }}>
        <Link
          to="/videos"
          style={{ color: "white", textDecoration: "none" }}
          activeProps={{ style: { fontWeight: "bold" } }}
        >
          Videos
        </Link>
        <Link
          to="/teams"
          style={{ color: "white", textDecoration: "none" }}
          activeProps={{ style: { fontWeight: "bold" } }}
        >
          Teams
        </Link>
        <Link
          to="/ranking"
          style={{ color: "white", textDecoration: "none" }}
          activeProps={{ style: { fontWeight: "bold" } }}
        >
          Ranking
        </Link>
        <Link
          to="/merge"
          style={{ color: "white", textDecoration: "none" }}
          activeProps={{ style: { fontWeight: "bold" } }}
        >
          Merge
        </Link>
        {isAdmin && (
          <Link
            to="/admin"
            style={{ color: "white", textDecoration: "none" }}
            activeProps={{ style: { fontWeight: "bold" } }}
          >
            Admin
          </Link>
        )}
      </div>
      <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
        <span>{user?.email}</span>
        <button
          onClick={handleSignOut}
          style={{
            padding: "0.5rem 1rem",
            backgroundColor: "#dc3545",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
          }}
        >
          Sign Out
        </button>
      </div>
    </nav>
  );
}

