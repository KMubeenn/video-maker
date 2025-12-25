import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "../lib/supabase.js";
import type { User, Session } from "@supabase/supabase-js";
import axios from "axios";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isAdmin: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let mounted = true;
    let timeoutId: ReturnType<typeof setTimeout>;
    let sessionResolved = false;

    // Set a timeout to prevent infinite loading
    timeoutId = setTimeout(() => {
      if (mounted && !sessionResolved) {
        console.warn("Session check timed out after 5 seconds, proceeding without authentication");
        sessionResolved = true;
        setLoading(false);
      }
    }, 5000); // 5 second timeout

    // Get initial session with a shorter timeout
    const sessionPromise = Promise.race([
      supabase.auth.getSession(),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error("Session check timeout")), 3000)
      )
    ]) as Promise<{ data: { session: Session | null }, error: any }>;

    sessionPromise
      .then(({ data: { session }, error }) => {
        if (!mounted || sessionResolved) return;
        
        sessionResolved = true;
        clearTimeout(timeoutId);
        
        if (error) {
          console.error("Error getting session:", error);
          setLoading(false);
          return;
        }

        console.log("Session loaded:", session ? "User authenticated" : "No session");
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          // Don't wait for admin check - do it in background
          checkAdminStatus().catch((err) => {
            console.error("Error checking admin status:", err);
          });
        }
        setLoading(false);
      })
      .catch((error) => {
        if (!mounted || sessionResolved) return;
        sessionResolved = true;
        console.error("Failed to get session:", error);
        clearTimeout(timeoutId);
        setLoading(false);
      });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      
      if (!sessionResolved) {
        sessionResolved = true;
        clearTimeout(timeoutId);
      }
      
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        // Don't wait for admin check - do it in background (same as getSession path)
        checkAdminStatus().catch((err) => {
          console.error("Error checking admin status:", err);
        });
      } else {
        setIsAdmin(false);
      }
      setLoading(false);
    });

    return () => {
      mounted = false;
      clearTimeout(timeoutId);
      subscription.unsubscribe();
    };
  }, []);

  const checkAdminStatus = async () => {
    try {
      // Use API endpoint instead of direct Supabase query to avoid RLS recursion
      const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000/api";
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        setIsAdmin(false);
        return;
      }

      const response = await axios.get(`${API_URL}/auth/me`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      setIsAdmin(response.data?.isAdmin || false);
    } catch (error: any) {
      // Silently fail - admin check is optional and defaults to false
      // Only log if it's not a 401 (unauthorized) which is expected when not logged in
      if (error.response?.status !== 401) {
        console.warn("Could not fetch admin status (this is non-critical):", error.message);
      }
      setIsAdmin(false);
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setIsAdmin(false);
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, isAdmin, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

