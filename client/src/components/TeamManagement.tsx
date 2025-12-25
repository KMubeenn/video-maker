import { useState, useEffect } from "react";
import { teamApi, type Team, type TeamMember } from "../api/team.api";
import { useAuth } from "../hooks/useAuth";
import { VideoLibrary } from "./VideoLibrary";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Plus, Users, Trash2, UserPlus, Shield, User, Video } from "lucide-react";
import { cn } from "@/lib/utils";

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
  const [activeTab, setActiveTab] = useState<"members" | "videos">("members");

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
      setError("");
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
      // Search for user via API (bypasses RLS issues)
      const user = await teamApi.searchUserByEmail(newMemberEmail.trim());

      if (!user || !user.id) {
        setError("User not found with that email address. The user must be registered in the system first.");
        return;
      }

      await teamApi.addMember(selectedTeam.id, user.id);
      await loadMembers(selectedTeam.id);
      setNewMemberEmail("");
      setError("");
    } catch (err: any) {
      // Handle API errors with better messages
      if (err.response?.status === 404) {
        setError(err.response.data?.error || "User not found with that email address. The user must be registered in the system first.");
      } else if (err.response?.status === 400) {
        setError(err.response.data?.error || "Invalid email address");
      } else {
        setError(err.response?.data?.error || err.message || "Failed to add member");
      }
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
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Teams</h1>
        <Button 
          onClick={() => setShowCreateForm(true)}
          className="transition-all duration-200 hover:shadow-lg hover:shadow-primary/30 hover:scale-105"
        >
          <Plus className="mr-2 h-4 w-4 transition-transform duration-200 group-hover:rotate-90" />
          Create Team
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Dialog open={showCreateForm} onOpenChange={setShowCreateForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Team</DialogTitle>
            <DialogDescription>
              Enter a name for your new team. You can add members after creation.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="team-name">Team Name</Label>
              <Input
                id="team-name"
                value={newTeamName}
                onChange={(e) => setNewTeamName(e.target.value)}
                placeholder="Enter team name"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleCreateTeam();
                  }
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowCreateForm(false);
              setNewTeamName("");
            }}>
              Cancel
            </Button>
            <Button onClick={handleCreateTeam}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[300px_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              My Teams
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-2">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : teams.length === 0 ? (
              <p className="text-sm text-muted-foreground">No teams yet. Create one to get started!</p>
            ) : (
              <div className="space-y-2">
                {teams.map((team) => (
                  <Button
                    key={team.id}
                    variant={selectedTeam?.id === team.id ? "default" : "outline"}
                    className={cn(
                      "w-full justify-start transition-all duration-200",
                      selectedTeam?.id === team.id 
                        ? "bg-primary text-primary-foreground shadow-md" 
                        : "hover:bg-accent hover:border-primary/50 hover:shadow-sm hover:scale-[1.02]"
                    )}
                    onClick={() => setSelectedTeam(team)}
                  >
                    {team.name}
                  </Button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {selectedTeam ? (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>{selectedTeam.name}</CardTitle>
                    <CardDescription>Manage team members, videos, and settings</CardDescription>
                  </div>
                  {currentUserRole === "admin" && (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={handleDeleteTeam}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete Team
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Tab Navigation */}
                <div className="flex gap-2 border-b">
                  <Button
                    variant={activeTab === "members" ? "default" : "ghost"}
                    onClick={() => setActiveTab("members")}
                    className={cn(
                      "rounded-b-none transition-all duration-200",
                      activeTab === "members" 
                        ? "bg-primary text-primary-foreground shadow-md" 
                        : "hover:bg-accent"
                    )}
                  >
                    <Users className="mr-2 h-4 w-4" />
                    Members
                  </Button>
                  <Button
                    variant={activeTab === "videos" ? "default" : "ghost"}
                    onClick={() => setActiveTab("videos")}
                    className={cn(
                      "rounded-b-none transition-all duration-200",
                      activeTab === "videos" 
                        ? "bg-primary text-primary-foreground shadow-md" 
                        : "hover:bg-accent"
                    )}
                  >
                    <Video className="mr-2 h-4 w-4" />
                    Videos
                  </Button>
                </div>

                {/* Members Tab */}
                {activeTab === "members" && (
                  <>
                {currentUserRole === "admin" && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <UserPlus className="h-4 w-4" />
                        Add Member
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex gap-2">
                        <Input
                          type="email"
                          value={newMemberEmail}
                          onChange={(e) => setNewMemberEmail(e.target.value)}
                          placeholder="Member email"
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              handleAddMember();
                            }
                          }}
                        />
                        <Button 
                          onClick={handleAddMember}
                          className="transition-all duration-200 hover:shadow-md hover:scale-105"
                        >
                          <UserPlus className="mr-2 h-4 w-4 transition-transform duration-200 hover:scale-110" />
                          Add
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}

                <div>
                  <h3 className="text-lg font-semibold mb-4">Members</h3>
                  {members.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No members yet</p>
                  ) : (
                    <div className="space-y-3">
                      {members.map((member) => (
                        <Card 
                          key={member.id}
                          className="transition-all duration-200 hover:shadow-md hover:border-primary/50 hover:-translate-y-0.5"
                        >
                          <CardContent className="flex items-center justify-between p-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <p className="font-medium transition-colors duration-200 hover:text-primary">
                                  {member.user_profiles?.full_name || member.user_profiles?.email}
                                </p>
                                <Badge 
                                  variant={member.role === "admin" ? "default" : "secondary"}
                                  className="transition-all duration-200 hover:scale-105 hover:shadow-sm"
                                >
                                  {member.role === "admin" ? (
                                    <Shield className="mr-1 h-3 w-3" />
                                  ) : (
                                    <User className="mr-1 h-3 w-3" />
                                  )}
                                  {member.role}
                                </Badge>
                              </div>
                              <p className="text-sm text-muted-foreground">
                                {member.user_profiles?.email}
                              </p>
                            </div>
                            {currentUserRole === "admin" && member.user_id !== user?.id && (
                              <div className="flex items-center gap-2">
                                <Select
                                  value={member.role}
                                  onValueChange={(value) =>
                                    handleUpdateRole(member.user_id, value as "admin" | "member")
                                  }
                                >
                                  <SelectTrigger className="w-32 transition-all duration-200 hover:border-primary/50 hover:shadow-sm">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="member">Member</SelectItem>
                                    <SelectItem value="admin">Admin</SelectItem>
                                  </SelectContent>
                                </Select>
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={() => handleRemoveMember(member.user_id)}
                                  className="transition-all duration-200 hover:bg-destructive/90 hover:shadow-md hover:scale-105"
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Remove
                                </Button>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
                  </>
                )}

                {/* Videos Tab */}
                {activeTab === "videos" && (
                  <div className="pt-4">
                    <VideoLibrary teamId={selectedTeam.id} />
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        ) : (
          <Card>
            <CardContent className="flex items-center justify-center py-12">
              <p className="text-muted-foreground">Select a team to view details</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
