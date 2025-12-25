import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useAuth } from "../hooks/useAuth";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ThemeSwitcher } from "./ThemeSwitcher";

export function Navigation() {
  const { user, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();
  const router = useRouterState();
  const currentPath = router.location.pathname;

  const handleSignOut = async () => {
    await signOut();
    navigate({ to: "/login" });
  };

  const getInitials = (email: string) => {
    return email
      .split("@")[0]
      .split(".")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <nav className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <div className="flex items-center gap-6">
          <Link
            to="/videos"
            className="text-xl font-bold text-primary transition-all duration-200 hover:scale-105 hover:opacity-80"
          >
            ShortMaker
          </Link>
          <div className="flex items-center gap-1">
            <Button
              variant={currentPath === "/videos" ? "default" : "ghost"}
              asChild
              className="transition-all duration-200 hover:scale-105 hover:shadow-md"
            >
              <Link to="/videos">Videos</Link>
            </Button>
            <Button
              variant={currentPath === "/teams" ? "default" : "ghost"}
              asChild
              className="transition-all duration-200 hover:scale-105 hover:shadow-md"
            >
              <Link to="/teams">Teams</Link>
            </Button>
            <Button
              variant={currentPath === "/ranking" ? "default" : "ghost"}
              asChild
              className="transition-all duration-200 hover:scale-105 hover:shadow-md"
            >
              <Link to="/ranking">Ranking</Link>
            </Button>
            <Button
              variant={currentPath === "/merge" ? "default" : "ghost"}
              asChild
              className="transition-all duration-200 hover:scale-105 hover:shadow-md"
            >
              <Link to="/merge">Merge</Link>
            </Button>
            {isAdmin && (
              <Button
                variant={currentPath === "/admin" ? "default" : "ghost"}
                asChild
                className="transition-all duration-200 hover:scale-105 hover:shadow-md"
              >
                <Link to="/admin">Admin</Link>
              </Button>
            )}
          </div>
        </div>
        <div className="flex items-center gap-4">
          <ThemeSwitcher />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-10 w-10 rounded-full transition-all duration-200 hover:scale-110 hover:shadow-md hover:ring-2 hover:ring-primary/50">
                <Avatar>
                  <AvatarFallback className="transition-all duration-200 hover:ring-2 hover:ring-primary/50">{getInitials(user?.email || "")}</AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
              <div className="flex items-center justify-start gap-2 p-2">
                <div className="flex flex-col space-y-1 leading-none">
                  <p className="font-medium">{user?.email}</p>
                </div>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer transition-all duration-200 hover:bg-destructive/10 hover:text-destructive">
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </nav>
  );
}

