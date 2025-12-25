import { useState, useEffect } from "react";
import { adminApi, type UserProfile } from "../api/admin.api";
import { useAuth } from "../hooks/useAuth";

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
      <div style={{ padding: "20px" }}>
        <div style={{ color: "red" }}>Access denied. Admin privileges required.</div>
      </div>
    );
  }

  return (
    <div style={{ padding: "20px" }}>
      <h1>User Management</h1>

      {error && (
        <div style={{ color: "red", marginBottom: "15px", padding: "10px", backgroundColor: "#f8d7da", borderRadius: "4px" }}>
          {error}
        </div>
      )}

      {loading ? (
        <div>Loading users...</div>
      ) : users.length === 0 ? (
        <div>No users found</div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ backgroundColor: "#f8f9fa" }}>
                <th style={{ padding: "10px", textAlign: "left", border: "1px solid #ddd" }}>Email</th>
                <th style={{ padding: "10px", textAlign: "left", border: "1px solid #ddd" }}>Full Name</th>
                <th style={{ padding: "10px", textAlign: "left", border: "1px solid #ddd" }}>Admin</th>
                <th style={{ padding: "10px", textAlign: "left", border: "1px solid #ddd" }}>Created</th>
                <th style={{ padding: "10px", textAlign: "left", border: "1px solid #ddd" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td style={{ padding: "10px", border: "1px solid #ddd" }}>{user.email}</td>
                  <td style={{ padding: "10px", border: "1px solid #ddd" }}>
                    {user.full_name || "-"}
                  </td>
                  <td style={{ padding: "10px", border: "1px solid #ddd" }}>
                    <input
                      type="checkbox"
                      checked={user.is_admin}
                      onChange={() => handleToggleAdmin(user.id, user.is_admin)}
                    />
                  </td>
                  <td style={{ padding: "10px", border: "1px solid #ddd" }}>
                    {user.created_at
                      ? new Date(user.created_at).toLocaleDateString()
                      : "-"}
                  </td>
                  <td style={{ padding: "10px", border: "1px solid #ddd" }}>
                    <button
                      onClick={() => handleDeleteUser(user.id)}
                      style={{
                        padding: "5px 10px",
                        backgroundColor: "#dc3545",
                        color: "white",
                        border: "none",
                        borderRadius: "4px",
                        cursor: "pointer",
                      }}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

