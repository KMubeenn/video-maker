import { useState, useEffect } from "react";
import { adminApi, type UserProfile } from "../api/admin.api";
import { useAuth } from "../hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Shield, Trash2, AlertCircle } from "lucide-react";

export function AdminPanel() {
  const { isAdmin } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isAdmin) {
      loadUsers();
    }
  }, [isAdmin]);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const data = await adminApi.listUsers();
      setUsers(data);
    } catch (err: any) {
      setError(err.message || "Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleAdmin = async (userId: string, currentStatus: boolean) => {
    try {
      await adminApi.updateUserAdmin(userId, !currentStatus);
      await loadUsers();
    } catch (err: any) {
      setError(err.message || "Failed to update admin status");
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm("Are you sure you want to delete this user? This action cannot be undone.")) return;

    try {
      await adminApi.deleteUser(userId);
      await loadUsers();
    } catch (err: any) {
      setError(err.message || "Failed to delete user");
    }
  };

  if (!isAdmin) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <AlertCircle className="h-12 w-12 text-destructive mb-4" />
          <p className="text-lg font-semibold">Access Denied</p>
          <p className="text-sm text-muted-foreground">Admin privileges required.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Shield className="h-6 w-6" />
        <h1 className="text-3xl font-bold tracking-tight">User Management</h1>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>All Users</CardTitle>
          <CardDescription>Manage user accounts and admin privileges</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-4">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : users.length === 0 ? (
            <p className="text-sm text-muted-foreground">No users found</p>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Full Name</TableHead>
                    <TableHead>Admin</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow 
                      key={user.id}
                      className="transition-all duration-200 hover:bg-accent/50 hover:shadow-sm cursor-pointer"
                    >
                      <TableCell className="font-medium transition-colors duration-200 hover:text-primary">{user.email}</TableCell>
                      <TableCell className="transition-colors duration-200">{user.full_name || "-"}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={user.is_admin}
                            onCheckedChange={() => handleToggleAdmin(user.id, user.is_admin)}
                            className="transition-all duration-200"
                          />
                          {user.is_admin && (
                            <Badge variant="default" className="gap-1 transition-all duration-200 hover:scale-105 hover:shadow-sm">
                              <Shield className="h-3 w-3" />
                              Admin
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="transition-colors duration-200">
                        {user.created_at
                          ? new Date(user.created_at).toLocaleDateString()
                          : "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDeleteUser(user.id)}
                          className="transition-all duration-200 hover:bg-destructive/90 hover:shadow-md hover:scale-105"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

