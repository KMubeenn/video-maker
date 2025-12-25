import { useNavigate } from "@tanstack/react-router";
import { useAuth } from "../hooks/useAuth";
import { useEffect } from "react";

export function IndexPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      navigate({ to: "/videos" });
    } else {
      navigate({ to: "/login" });
    }
  }, [user, navigate]);

  return null;
}

