import { useState, useEffect } from "react";
import { teamApi, type Team, type TeamMember } from "../api/team.api";
import { useAuth } from "../hooks/useAuth";
import { supabase } from "../lib/supabase";

export function TeamManagement() {
  const { user } = useAuth();
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newTeamName, setNewTeamName] = useState("");
  const [newMemberEmail, setNewMemberEmail] = useState("");

  useEffect(() => {
    loadTeams();
  }, []);

  useEffect(() => {
    if (selectedTeam?.id) {
      loadMembers(selectedTeam.id);
    }
  }, [selectedTeam]);

  const loadTeams = async () => {
    try {
      setLoading(true);
      const data = await teamApi.list();
      setTeams(data);
      if (data.length > 0 && !selectedTeam) {
        setSelectedTeam(data[0]);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load teams");
    } finally {
      setLoading(false);
    }
  };

  const loadMembers = async (teamId: string) => {
    try {
      const data = await teamApi.getMembers(teamId);
      setMembers(data);
    } catch (err: any) {
      setError(err.message || "Failed to load members");
    }
  };

  const handleCreateTeam = async () => {
    if (!newTeamName.trim()) {
      setError("Team name is required");
      return;
    }

    try {
      const team = await teamApi.create(newTeamName);
      setTeams([...teams, team]);
      setSelectedTeam(team);
      setShowCreateForm(false);
      setNewTeamName("");
    } catch (err: any) {
      setError(err.message || "Failed to create team");
    }
  };

  const handleAddMember = async () => {
    if (!selectedTeam?.id || !newMemberEmail.trim()) {
      setError("Team and member email are required");
      return;
    }

    try {
      // Find user by email
      const { data: users } = await supabase
        .from("user_profiles")
        .select("id")
        .eq("email", newMemberEmail)
        .single();

      if (!users) {
        setError("User not found");
        return;
      }

      await teamApi.addMember(selectedTeam.id, users.id);
      await loadMembers(selectedTeam.id);
      setNewMemberEmail("");
    } catch (err: any) {
      setError(err.message || "Failed to add member");
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!selectedTeam?.id) return;
    if (!confirm("Are you sure you want to remove this member?")) return;

    try {
      await teamApi.removeMember(selectedTeam.id, userId);
      await loadMembers(selectedTeam.id);
    } catch (err: any) {
      setError(err.message || "Failed to remove member");
    }
  };

  const handleUpdateRole = async (userId: string, newRole: "admin" | "member") => {
    if (!selectedTeam?.id) return;

    try {
      await teamApi.updateMemberRole(selectedTeam.id, userId, newRole);
      await loadMembers(selectedTeam.id);
    } catch (err: any) {
      setError(err.message || "Failed to update role");
    }
  };

  const handleDeleteTeam = async () => {
    if (!selectedTeam?.id) return;
    if (!confirm("Are you sure you want to delete this team? This action cannot be undone.")) return;

    try {
      await teamApi.delete(selectedTeam.id);
      await loadTeams();
      setSelectedTeam(null);
    } catch (err: any) {
      setError(err.message || "Failed to delete team");
    }
  };

  const currentUserRole = members.find((m) => m.user_id === user?.id)?.role;

  return (
    <div style={{ padding: "20px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <h1>Teams</h1>
        <button
          onClick={() => setShowCreateForm(true)}
          style={{
            padding: "10px 20px",
            backgroundColor: "#007bff",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
          }}
        >
          Create Team
        </button>
      </div>

      {showCreateForm && (
        <div style={{ marginBottom: "20px", padding: "15px", border: "1px solid #ddd", borderRadius: "4px" }}>
          <h3>Create New Team</h3>
          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            <input
              type="text"
              value={newTeamName}
              onChange={(e) => setNewTeamName(e.target.value)}
              placeholder="Team name"
              style={{ flex: 1, padding: "8px", boxSizing: "border-box" }}
            />
            <button
              onClick={handleCreateTeam}
              style={{
                padding: "8px 16px",
                backgroundColor: "#28a745",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
              }}
            >
              Create
            </button>
            <button
              onClick={() => {
                setShowCreateForm(false);
                setNewTeamName("");
              }}
              style={{
                padding: "8px 16px",
                backgroundColor: "#6c757d",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {error && (
        <div style={{ color: "red", marginBottom: "15px", padding: "10px", backgroundColor: "#f8d7da", borderRadius: "4px" }}>
          {error}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: "20px" }}>
        <div>
          <h2>My Teams</h2>
          {loading ? (
            <div>Loading teams...</div>
          ) : teams.length === 0 ? (
            <div>No teams yet. Create one to get started!</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {teams.map((team) => (
                <div
                  key={team.id}
                  onClick={() => setSelectedTeam(team)}
                  style={{
                    padding: "10px",
                    border: selectedTeam?.id === team.id ? "2px solid #007bff" : "1px solid #ddd",
                    borderRadius: "4px",
                    cursor: "pointer",
                    backgroundColor: selectedTeam?.id === team.id ? "#e7f3ff" : "white",
                  }}
                >
                  {team.name}
                </div>
              ))}
            </div>
          )}
        </div>

        {selectedTeam && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <h2>{selectedTeam.name}</h2>
              {currentUserRole === "admin" && (
                <button
                  onClick={handleDeleteTeam}
                  style={{
                    padding: "8px 16px",
                    backgroundColor: "#dc3545",
                    color: "white",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                  }}
                >
                  Delete Team
                </button>
              )}
            </div>

            {currentUserRole === "admin" && (
              <div style={{ marginBottom: "20px", padding: "15px", border: "1px solid #ddd", borderRadius: "4px" }}>
                <h3>Add Member</h3>
                <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                  <input
                    type="email"
                    value={newMemberEmail}
                    onChange={(e) => setNewMemberEmail(e.target.value)}
                    placeholder="Member email"
                    style={{ flex: 1, padding: "8px", boxSizing: "border-box" }}
                  />
                  <button
                    onClick={handleAddMember}
                    style={{
                      padding: "8px 16px",
                      backgroundColor: "#28a745",
                      color: "white",
                      border: "none",
                      borderRadius: "4px",
                      cursor: "pointer",
                    }}
                  >
                    Add
                  </button>
                </div>
              </div>
            )}

            <h3>Members</h3>
            {members.length === 0 ? (
              <div>No members yet</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {members.map((member) => (
                  <div
                    key={member.id}
                    style={{
                      padding: "15px",
                      border: "1px solid #ddd",
                      borderRadius: "4px",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <div>
                      <div>
                        <strong>{member.user_profiles?.full_name || member.user_profiles?.email}</strong>
                      </div>
                      <div style={{ color: "#666", fontSize: "0.9em" }}>
                        {member.user_profiles?.email}
                      </div>
                      <div style={{ color: "#666", fontSize: "0.9em" }}>
                        Role: {member.role}
                      </div>
                    </div>
                    {currentUserRole === "admin" && member.user_id !== user?.id && (
                      <div style={{ display: "flex", gap: "10px" }}>
                        <select
                          value={member.role}
                          onChange={(e) =>
                            handleUpdateRole(member.user_id, e.target.value as "admin" | "member")
                          }
                          style={{ padding: "5px" }}
                        >
                          <option value="member">Member</option>
                          <option value="admin">Admin</option>
                        </select>
                        <button
                          onClick={() => handleRemoveMember(member.user_id)}
                          style={{
                            padding: "5px 10px",
                            backgroundColor: "#dc3545",
                            color: "white",
                            border: "none",
                            borderRadius: "4px",
                            cursor: "pointer",
                          }}
                        >
                          Remove
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

