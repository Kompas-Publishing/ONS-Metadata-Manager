import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Shield,
  UserCog,
  Eye,
  Lock,
  Users,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  XCircle,
  Archive,
  Trash2,
  Plus,
  FileText,
  Edit,
  X,
  Sparkles,
  Check,
  Copy,
  ShieldCheck,
  AlertTriangle,
  CheckSquare,
  Loader2,
  Settings,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";
import type { User, Group, Setting } from "@shared/schema";
import { useEffect, useState } from "react";

function AiConfigSection() {
  const { toast } = useToast();
  const { data: aiSettings, isLoading } = useQuery<{ settings: Setting[] }>({
    queryKey: ['/api/admin/settings/ai'],
  });

  const [provider, setProvider] = useState("google");
  const [model, setModel] = useState("gemini-3-pro-preview");
  const [apiKey, setApiKey] = useState("");

  useEffect(() => {
    if (aiSettings?.settings) {
      const p = aiSettings.settings.find(s => s.key === "ai_provider")?.value;
      const m = aiSettings.settings.find(s => s.key === "ai_model")?.value;
      const k = aiSettings.settings.find(s => s.key === "ai_api_key")?.value;
      if (p) setProvider(p);
      if (m) setModel(m);
      if (k) setApiKey(k);
    }
  }, [aiSettings]);

  const updateAiConfigMutation = useMutation({
    mutationFn: async (config: { provider: string; model: string; apiKey: string }) => {
      await apiRequest('POST', '/api/admin/settings/ai', config);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/settings/ai'] });
      toast({ title: "Success", description: "AI configuration saved" });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save AI configuration",
        variant: "destructive",
      });
    },
  });

  if (isLoading) return <Skeleton className="h-48 w-full" />;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Sparkles className="w-5 h-5 text-primary" />
        <h2 className="text-xl font-semibold text-foreground">AI Configuration</h2>
      </div>
      <Card className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label htmlFor="ai-provider">AI Provider</Label>
            <Select value={provider} onValueChange={setProvider}>
              <SelectTrigger id="ai-provider">
                <SelectValue placeholder="Select provider" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="google">Google Gemini</SelectItem>
                <SelectItem value="openai">OpenAI (Planned)</SelectItem>
                <SelectItem value="anthropic">Anthropic (Planned)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="ai-model">Model</Label>
            <Select value={model} onValueChange={setModel}>
              <SelectTrigger id="ai-model">
                <SelectValue placeholder="Select model" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="gemini-3-pro-preview">Gemini 3 Pro (Preview)</SelectItem>
                <SelectItem value="gemini-3-flash-preview">Gemini 3 Flash (Preview)</SelectItem>
                <SelectItem value="gemini-3-deep-think">Gemini 3 Deep Think</SelectItem>
                <SelectItem value="gemini-1.5-pro">Gemini 1.5 Pro</SelectItem>
                <SelectItem value="gemini-1.5-flash">Gemini 1.5 Flash</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2 space-y-2">
            <Label htmlFor="ai-api-key">API Key</Label>
            <div className="flex gap-2">
              <Input
                id="ai-api-key"
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Enter your API key"
                className="flex-grow"
              />
              <Button
                onClick={() => updateAiConfigMutation.mutate({ provider, model, apiKey })}
                disabled={updateAiConfigMutation.isPending}
              >
                Save Configuration
              </Button>
            </div>
            <div className="flex flex-col gap-1 mt-2">
              <p className="text-xs text-muted-foreground">
                Currently, only Google Gemini is supported. Gemini 3 is now available.
              </p>
              <p className="text-xs text-yellow-600 font-medium">
                Note: Vercel has a 4.5MB limit for file uploads. For large metadata files, please save as CSV before uploading to significantly reduce size.
              </p>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}

export default function Admin({ tab = "users" }: { tab?: "users" | "settings" }) {
  const { user: currentUser, isLoading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [expandedUsers, setExpandedUsers] = useState<Set<string>>(new Set());
  const [createGroupOpen, setCreateGroupOpen] = useState(false);
  const [deleteUserConfirm, setDeleteUserConfirm] = useState<string | null>(null);
  const [deleteGroupConfirm, setDeleteGroupConfirm] = useState<string | null>(null);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupDescription, setNewGroupDescription] = useState("");
  const [resetConfirmUser, setResetConfirmUser] = useState<User | null>(null);
  const [resetPasswordData, setResetPasswordData] = useState<{ email: string; password: string } | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    document.title = tab === "users" ? "Users & Groups | Admin" : "System Settings | Admin";
  }, [tab]);

  useEffect(() => {
    if (!authLoading && (!currentUser || currentUser.isAdmin !== 1)) {
      setLocation("/");
    }
  }, [currentUser, authLoading, setLocation]);

  const { data, isLoading } = useQuery<{ users: User[] }>({
    queryKey: ['/api/admin/users'],
    enabled: !authLoading && currentUser?.isAdmin === 1,
  });

  const { data: groupsData } = useQuery<{ groups: Group[] }>({
    queryKey: ['/api/admin/groups'],
    enabled: !authLoading && currentUser?.isAdmin === 1,
  });

  // User status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ userId, status }: { userId: string; status: string }) => {
      const res = await apiRequest('PATCH', `/api/admin/users/${userId}/status`, { status });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      toast({ title: "Success", description: "User status updated" });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update user status",
        variant: "destructive",
      });
    },
  });

    // User permissions mutation
    const updatePermissionsMutation = useMutation({
      mutationFn: async ({ userId, permissions }: { 
        userId: string; 
        permissions: { 
          canReadMetadata: number; 
          canWriteMetadata: number;
          canReadLicenses: number;
          canWriteLicenses: number;
          canReadTasks: number;
          canWriteTasks: number;
          canUseAI: number;
          canUseAIChat: number;
        } 
      }) => {
        const res = await apiRequest('PATCH', `/api/admin/users/${userId}/permissions`, permissions);
        return await res.json();
      },
      onMutate: async ({ userId, permissions }) => {
        // Cancel any outgoing refetches (so they don't overwrite our optimistic update)
        await queryClient.cancelQueries({ queryKey: ['/api/admin/users'] });
  
        // Snapshot the previous value
        const previousData = queryClient.getQueryData<{ users: User[] }>(['/api/admin/users']);
  
        // Optimistically update to the new value
        if (previousData) {
          queryClient.setQueryData(['/api/admin/users'], {
            ...previousData,
            users: previousData.users.map(u => 
              u.id === userId ? { ...u, ...permissions } : u
            )
          });
        }
  
        return { previousData };
      },
      onError: (error: any, __, context) => {
        // Rollback to the previous value if there's an error
        if (context?.previousData) {
          queryClient.setQueryData(['/api/admin/users'], context.previousData);
        }
        toast({
          title: "Error",
          description: error.message || "Failed to update permissions",
          variant: "destructive",
        });
      },
      onSettled: () => {
        // Always refetch after error or success to ensure we're in sync with the server
        queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      },
    });
  // Password reset mutation
  const resetPasswordMutation = useMutation({
    mutationFn: async ({ userId, email }: { userId: string; email: string }) => {
      const res = await apiRequest('POST', `/api/admin/users/${userId}/reset-password`, {});
      const data = await res.json();
      return { ...data, email };
    },
    onSuccess: (data) => {
      setResetConfirmUser(null);
      setResetPasswordData({
        email: data.email,
        password: data.newPassword
      });
      toast({ 
        title: "Password Reset Successful", 
        description: "New password generated.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to reset password",
        variant: "destructive",
      });
    },
  });

  // User visibility mutation
  const updateVisibilityMutation = useMutation({
    mutationFn: async ({ userId, fileVisibility }: { userId: string; fileVisibility: string }) => {
      const res = await apiRequest('PATCH', `/api/admin/users/${userId}/visibility`, { fileVisibility });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      toast({ title: "Success", description: "Visibility updated" });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update visibility",
        variant: "destructive",
      });
    },
  });

  // User groups assignment mutation (multi-select)
  const updateGroupsMutation = useMutation({
    mutationFn: async ({ userId, groupIds }: { userId: string; groupIds: string[] }) => {
      const res = await apiRequest('PATCH', `/api/admin/users/${userId}/groups`, { groupIds });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      toast({ title: "Success", description: "Groups updated" });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update groups",
        variant: "destructive",
      });
    },
  });

  // Toggle admin mutation
  const toggleAdminMutation = useMutation({
    mutationFn: async ({ userId, isAdmin }: { userId: string; isAdmin: boolean }) => {
      const res = await apiRequest('PATCH', `/api/admin/users/${userId}`, { isAdmin });
      return await res.json();
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      toast({
        title: "Success",
        description: variables.isAdmin
          ? "User granted admin privileges"
          : "User admin privileges revoked",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update user admin status",
        variant: "destructive",
      });
    },
  });

  // Delete user mutation
  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      const res = await apiRequest('DELETE', `/api/admin/users/${userId}`);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      toast({ title: "Success", description: "User deleted" });
      setDeleteUserConfirm(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete user",
        variant: "destructive",
      });
    },
  });

  // Create group mutation
  const createGroupMutation = useMutation({
    mutationFn: async ({ name, description }: { name: string; description?: string }) => {
      const res = await apiRequest('POST', '/api/admin/groups', { name, description });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/groups'] });
      toast({ title: "Success", description: "Group created" });
      setCreateGroupOpen(false);
      setNewGroupName("");
      setNewGroupDescription("");
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create group",
        variant: "destructive",
      });
    },
  });

  // Delete group mutation
  const deleteGroupMutation = useMutation({
    mutationFn: async (groupId: string) => {
      const res = await apiRequest('DELETE', `/api/admin/groups/${groupId}`);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/groups'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      toast({ title: "Success", description: "Group deleted" });
      setDeleteGroupConfirm(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete group",
        variant: "destructive",
      });
    },
  });

  const toggleUserExpanded = (userId: string) => {
    const newExpanded = new Set(expandedUsers);
    if (newExpanded.has(userId)) {
      newExpanded.delete(userId);
    } else {
      newExpanded.add(userId);
    }
    setExpandedUsers(newExpanded);
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "active":
        return "default";
      case "pending":
        return "outline";
      case "archived":
        return "secondary";
      default:
        return "secondary";
    }
  };

  const getGroupName = (groupId: string | null) => {
    if (!groupId || !groupsData?.groups) return "None";
    const group = groupsData.groups.find(g => g.id === groupId);
    return group?.name || "Unknown";
  };

  const getUserCountForGroup = (groupId: string) => {
    if (!data?.users) return 0;
    return data.users.filter(u => u.groupIds?.includes(groupId)).length;
  };

  if (authLoading || isLoading) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-semibold text-foreground">Admin Panel</h1>
          <p className="text-muted-foreground mt-2">
            Manage user permissions and admin access
          </p>
        </div>

        <Card className="p-6">
          <div className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        </Card>
      </div>
    );
  }

  const users = data?.users || [];
  const groups = groupsData?.groups || [];

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <div>
        <div className="flex items-center gap-3 mb-2">
          <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
            {tab === "users" ? <Shield className="w-6 h-6 text-primary" /> : <Settings className="w-6 h-6 text-primary" />}
          </div>
          <h1 className="text-3xl font-semibold text-foreground">
            {tab === "users" ? "Users & Groups" : "System Settings"}
          </h1>
        </div>
        <p className="text-muted-foreground">
          {tab === "users" 
            ? "Manage user access, permissions, and organizational groups" 
            : "Configure global system parameters and AI settings"}
        </p>
      </div>

      {tab === "users" ? (
        <>
          {/* User Management Section */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-foreground">User Management</h2>
            {users.length === 0 ? (
              <Card className="p-12 text-center">
                <UserCog className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No users found</p>
              </Card>
            ) : (
              <Card className="p-6">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12"></TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Permissions</TableHead>
                      <TableHead>Visibility</TableHead>
                      <TableHead>Group</TableHead>
                      <TableHead>Admin</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((user) => {
                      const isCurrentUser = currentUser?.id === user.id;
                      const isAdmin = user.isAdmin === 1;
                      const isExpanded = expandedUsers.has(user.id);

                      return (
                        <Collapsible
                          key={user.id}
                          open={isExpanded}
                          onOpenChange={() => toggleUserExpanded(user.id)}
                          asChild
                        >
                          <>
                            <TableRow data-testid={`row-user-${user.id}`}>
                              <TableCell>
                                <CollapsibleTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    data-testid={`button-expand-${user.id}`}
                                  >
                                    {isExpanded ? (
                                      <ChevronDown className="w-4 h-4" />
                                    ) : (
                                      <ChevronRight className="w-4 h-4" />
                                    )}
                                  </Button>
                                </CollapsibleTrigger>
                              </TableCell>
                              <TableCell className="font-medium" data-testid={`text-email-${user.id}`}>
                                {user.email || "N/A"}
                              </TableCell>
                              <TableCell data-testid={`text-name-${user.id}`}>
                                {user.firstName && user.lastName
                                  ? `${user.firstName} ${user.lastName}`
                                  : "N/A"}
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant={getStatusBadgeVariant(user.status)}
                                  data-testid={`badge-status-${user.id}`}
                                >
                                  {user.status}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <div className="flex flex-wrap gap-1 max-w-[200px]">
                                  {user.canReadMetadata === 1 && (
                                    <Badge variant="secondary" className="text-[10px] px-1 h-5">Meta:R</Badge>
                                  )}
                                  {user.canWriteMetadata === 1 && (
                                    <Badge variant="secondary" className="text-[10px] px-1 h-5">Meta:W</Badge>
                                  )}
                                  {user.canReadLicenses === 1 && (
                                    <Badge variant="secondary" className="text-[10px] px-1 h-5">Lic:R</Badge>
                                  )}
                                  {user.canWriteLicenses === 1 && (
                                    <Badge variant="secondary" className="text-[10px] px-1 h-5">Lic:W</Badge>
                                  )}
                                  {user.canReadTasks === 1 && (
                                    <Badge variant="secondary" className="text-[10px] px-1 h-5">Task:R</Badge>
                                  )}
                                  {user.canWriteTasks === 1 && (
                                    <Badge variant="secondary" className="text-[10px] px-1 h-5">Task:W</Badge>
                                  )}
                                  {user.canUseAI === 1 && (
                                    <Badge variant="secondary" className="text-[10px] px-1 h-5">AI</Badge>
                                  )}
                                  {user.canUseAIChat === 1 && (
                                    <Badge variant="secondary" className="text-[10px] px-1 h-5">AI Chat</Badge>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell data-testid={`text-visibility-${user.id}`}>
                                {user.fileVisibility}
                              </TableCell>
                              <TableCell data-testid={`text-group-${user.id}`}>
                                {user.groupIds && user.groupIds.length > 0 
                                  ? user.groupIds.map(gid => getGroupName(gid)).join(", ")
                                  : "None"}
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant={isAdmin ? "default" : "secondary"}
                                  data-testid={`badge-admin-${user.id}`}
                                >
                                  {isAdmin ? "Admin" : "User"}
                                </Badge>
                              </TableCell>
                            </TableRow>
                            <TableRow>
                              <TableCell colSpan={8} className="p-0">
                                <CollapsibleContent>
                                  <div className="p-6 border-t bg-muted/20">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                      {/* Status Management */}
                                      <div className="space-y-4">
                                        <h3 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
                                          Status Management
                                        </h3>
                                        <div className="flex flex-wrap gap-2">
                                          {user.status === "pending" && (
                                            <Button
                                              variant="outline"
                                              onClick={() =>
                                                updateStatusMutation.mutate({
                                                  userId: user.id,
                                                  status: "active",
                                                })
                                              }
                                              disabled={updateStatusMutation.isPending}
                                              data-testid={`button-approve-${user.id}`}
                                            >
                                              <CheckCircle2 className="w-4 h-4 mr-2" />
                                              Approve
                                            </Button>
                                          )}
                                          {user.status === "active" && !isCurrentUser && (
                                            <Button
                                              variant="outline"
                                              onClick={() =>
                                                updateStatusMutation.mutate({
                                                  userId: user.id,
                                                  status: "archived",
                                                })
                                              }
                                              disabled={updateStatusMutation.isPending}
                                              data-testid={`button-archive-${user.id}`}
                                            >
                                              <Archive className="w-4 h-4 mr-2" />
                                              Archive
                                            </Button>
                                          )}
                                          {user.status === "archived" && (
                                            <Button
                                              variant="outline"
                                              onClick={() =>
                                                updateStatusMutation.mutate({
                                                  userId: user.id,
                                                  status: "active",
                                                })
                                              }
                                              disabled={updateStatusMutation.isPending}
                                              data-testid={`button-unarchive-${user.id}`}
                                            >
                                              <CheckCircle2 className="w-4 h-4 mr-2" />
                                              Unarchive
                                            </Button>
                                          )}
                                          {!isCurrentUser && (
                                            <Button
                                              variant="outline"
                                              onClick={() => setDeleteUserConfirm(user.id)}
                                              disabled={deleteUserMutation.isPending}
                                              data-testid={`button-delete-${user.id}`}
                                            >
                                              <Trash2 className="w-4 h-4 mr-2" />
                                              Delete
                                            </Button>
                                          )}
                                        </div>
                                      </div>

                                      {/* Admin & Security */}
                                      <div className="space-y-4">
                                        <h3 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
                                          Admin & Security
                                        </h3>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                          <Card className="p-4 bg-background/50">
                                            <div className="flex items-center justify-between mb-4">
                                              <div className="flex items-center gap-2">
                                                <Shield className="w-4 h-4 text-primary" />
                                                <span className="font-semibold text-sm">Administrator</span>
                                              </div>
                                              <Switch
                                                checked={isAdmin}
                                                onCheckedChange={(checked) =>
                                                  toggleAdminMutation.mutate({
                                                    userId: user.id,
                                                    isAdmin: checked,
                                                  })
                                                }
                                                disabled={isCurrentUser || toggleAdminMutation.isPending}
                                              />
                                            </div>
                                            <p className="text-xs text-muted-foreground">
                                              Admins bypass all permission checks and have full access to the system.
                                            </p>
                                          </Card>

                                          <Card className="p-4 bg-background/50">
                                            <div className="flex items-center gap-2 mb-4">
                                              <Lock className="w-4 h-4 text-primary" />
                                              <span className="font-semibold text-sm">Account Security</span>
                                            </div>
                                            <Button
                                              variant="outline"
                                              onClick={() => setResetConfirmUser(user)}
                                              disabled={resetPasswordMutation.isPending}
                                              className="w-full justify-start"
                                            >
                                              <Lock className="w-4 h-4 mr-2" />
                                              Reset User Password
                                            </Button>
                                          </Card>
                                        </div>
                                      </div>

                                      {/* Permissions Sections */}
                                      <div className="space-y-4 md:col-span-2">
                                        <h3 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
                                          Feature Permissions
                                        </h3>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                          {/* Metadata Card */}
                                          <Card className="p-4 bg-background/50">
                                            <div className="flex items-center gap-2 mb-4">
                                              <FileText className="w-4 h-4 text-blue-500" />
                                              <span className="font-semibold text-sm">Metadata</span>
                                            </div>
                                            <div className="space-y-3">
                                              <div className="flex items-center justify-between">
                                                <Label className="text-xs">Read Access</Label>
                                                <Switch
                                                  checked={user.canReadMetadata === 1}
                                                  onCheckedChange={(checked) => updatePermissionsMutation.mutate({
                                                    userId: user.id,
                                                    permissions: {
                                                      canReadMetadata: checked ? 1 : 0,
                                                      canWriteMetadata: user.canWriteMetadata,
                                                      canReadLicenses: user.canReadLicenses,
                                                      canWriteLicenses: user.canWriteLicenses,
                                                      canReadTasks: user.canReadTasks,
                                                      canWriteTasks: user.canWriteTasks,
                                                      canUseAI: user.canUseAI,
                                                      canUseAIChat: user.canUseAIChat,
                                                    }
                                                  })}
                                                />
                                              </div>
                                              <div className="flex items-center justify-between">
                                                <Label className="text-xs">Write Access</Label>
                                                <Switch
                                                  checked={user.canWriteMetadata === 1}
                                                  onCheckedChange={(checked) => updatePermissionsMutation.mutate({
                                                    userId: user.id,
                                                    permissions: {
                                                      canReadMetadata: user.canReadMetadata,
                                                      canWriteMetadata: checked ? 1 : 0,
                                                      canReadLicenses: user.canReadLicenses,
                                                      canWriteLicenses: user.canWriteLicenses,
                                                      canReadTasks: user.canReadTasks,
                                                      canWriteTasks: user.canWriteTasks,
                                                      canUseAI: user.canUseAI,
                                                      canUseAIChat: user.canUseAIChat,
                                                    }
                                                  })}
                                                />
                                              </div>
                                            </div>
                                          </Card>

                                          {/* Licenses Card */}
                                          <Card className="p-4 bg-background/50">
                                            <div className="flex items-center gap-2 mb-4">
                                              <ShieldCheck className="w-4 h-4 text-green-500" />
                                              <span className="font-semibold text-sm">Licenses</span>
                                            </div>
                                            <div className="space-y-3">
                                              <div className="flex items-center justify-between">
                                                <Label className="text-xs">Read Access</Label>
                                                <Switch
                                                  checked={user.canReadLicenses === 1}
                                                  onCheckedChange={(checked) => updatePermissionsMutation.mutate({
                                                    userId: user.id,
                                                    permissions: {
                                                      canReadMetadata: user.canReadMetadata,
                                                      canWriteMetadata: user.canWriteMetadata,
                                                      canReadLicenses: checked ? 1 : 0,
                                                      canWriteLicenses: user.canWriteLicenses,
                                                      canReadTasks: user.canReadTasks,
                                                      canWriteTasks: user.canWriteTasks,
                                                      canUseAI: user.canUseAI,
                                                      canUseAIChat: user.canUseAIChat,
                                                    }
                                                  })}
                                                />
                                              </div>
                                              <div className="flex items-center justify-between">
                                                <Label className="text-xs">Write Access</Label>
                                                <Switch
                                                  checked={user.canWriteLicenses === 1}
                                                  onCheckedChange={(checked) => updatePermissionsMutation.mutate({
                                                    userId: user.id,
                                                    permissions: {
                                                      canReadMetadata: user.canReadMetadata,
                                                      canWriteMetadata: user.canWriteMetadata,
                                                      canReadLicenses: user.canReadLicenses,
                                                      canWriteLicenses: checked ? 1 : 0,
                                                      canReadTasks: user.canReadTasks,
                                                      canWriteTasks: user.canWriteTasks,
                                                      canUseAI: user.canUseAI,
                                                      canUseAIChat: user.canUseAIChat,
                                                    }
                                                  })}
                                                />
                                              </div>
                                            </div>
                                          </Card>

                                          {/* Tasks Card */}
                                          <Card className="p-4 bg-background/50">
                                            <div className="flex items-center gap-2 mb-4">
                                              <CheckSquare className="w-4 h-4 text-orange-500" />
                                              <span className="font-semibold text-sm">Tasks</span>
                                            </div>
                                            <div className="space-y-3">
                                              <div className="flex items-center justify-between">
                                                <Label className="text-xs">Read Access</Label>
                                                <Switch
                                                  checked={user.canReadTasks === 1}
                                                  onCheckedChange={(checked) => updatePermissionsMutation.mutate({
                                                    userId: user.id,
                                                    permissions: {
                                                      canReadMetadata: user.canReadMetadata,
                                                      canWriteMetadata: user.canWriteMetadata,
                                                      canReadLicenses: user.canReadLicenses,
                                                      canWriteLicenses: user.canWriteLicenses,
                                                      canReadTasks: checked ? 1 : 0,
                                                      canWriteTasks: user.canWriteTasks,
                                                      canUseAI: user.canUseAI,
                                                      canUseAIChat: user.canUseAIChat,
                                                    }
                                                  })}
                                                />
                                              </div>
                                              <div className="flex items-center justify-between">
                                                <Label className="text-xs">Write Access</Label>
                                                <Switch
                                                  checked={user.canWriteTasks === 1}
                                                  onCheckedChange={(checked) => updatePermissionsMutation.mutate({
                                                    userId: user.id,
                                                    permissions: {
                                                      canReadMetadata: user.canReadMetadata,
                                                      canWriteMetadata: user.canWriteMetadata,
                                                      canReadLicenses: user.canReadLicenses,
                                                      canWriteLicenses: user.canWriteLicenses,
                                                      canReadTasks: user.canReadTasks,
                                                      canWriteTasks: checked ? 1 : 0,
                                                      canUseAI: user.canUseAI,
                                                      canUseAIChat: user.canUseAIChat,
                                                    }
                                                  })}
                                                />
                                              </div>
                                            </div>
                                          </Card>

                                          {/* AI Card */}
                                          <Card className="p-4 bg-background/50">
                                            <div className="flex items-center gap-2 mb-4">
                                              <Sparkles className="w-4 h-4 text-purple-500" />
                                              <span className="font-semibold text-sm">AI Tools</span>
                                            </div>
                                            <div className="space-y-3">
                                              <div className="flex items-center justify-between">
                                                <Label className="text-xs">AI Uploader</Label>
                                                <Switch
                                                  checked={user.canUseAI === 1}
                                                  onCheckedChange={(checked) => updatePermissionsMutation.mutate({
                                                    userId: user.id,
                                                    permissions: {
                                                      canReadMetadata: user.canReadMetadata,
                                                      canWriteMetadata: user.canWriteMetadata,
                                                      canReadLicenses: user.canReadLicenses,
                                                      canWriteLicenses: user.canWriteLicenses,
                                                      canReadTasks: user.canReadTasks,
                                                      canWriteTasks: user.canWriteTasks,
                                                      canUseAI: checked ? 1 : 0,
                                                      canUseAIChat: user.canUseAIChat,
                                                    }
                                                  })}
                                                />
                                              </div>
                                              <div className="flex items-center justify-between">
                                                <Label className="text-xs">AI Chat</Label>
                                                <Switch
                                                  checked={user.canUseAIChat === 1}
                                                  onCheckedChange={(checked) => updatePermissionsMutation.mutate({
                                                    userId: user.id,
                                                    permissions: {
                                                      canReadMetadata: user.canReadMetadata,
                                                      canWriteMetadata: user.canWriteMetadata,
                                                      canReadLicenses: user.canReadLicenses,
                                                      canWriteLicenses: user.canWriteLicenses,
                                                      canReadTasks: user.canReadTasks,
                                                      canWriteTasks: user.canWriteTasks,
                                                      canUseAI: user.canUseAI,
                                                      canUseAIChat: checked ? 1 : 0,
                                                    }
                                                  })}
                                                />
                                              </div>
                                              <p className="text-[10px] text-muted-foreground leading-tight pt-1">
                                                AI Chat is read/write scoped by the user's existing permissions.
                                              </p>
                                            </div>
                                          </Card>
                                        </div>
                                      </div>

                                      {/* Visibility Settings */}
                                      <div className="space-y-4">
                                        <h3 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
                                          Visibility Settings
                                        </h3>
                                        <div className="space-y-2">
                                          <div>
                                            <Label htmlFor={`visibility-${user.id}`} className="text-sm">
                                              File Visibility
                                            </Label>
                                            <Select
                                              value={user.fileVisibility}
                                              onValueChange={(value) => {
                                                // Validate before allowing group visibility
                                                if (value === 'group' && (!user.groupIds || user.groupIds.length === 0)) {
                                                  toast({
                                                    title: "Cannot Set Group Visibility",
                                                    description: "Please assign the user to at least one group first",
                                                    variant: "destructive",
                                                  });
                                                  return;
                                                }
                                                
                                                updateVisibilityMutation.mutate({
                                                  userId: user.id,
                                                  fileVisibility: value,
                                                });
                                              }}
                                              disabled={updateVisibilityMutation.isPending}
                                            >
                                              <SelectTrigger
                                                id={`visibility-${user.id}`}
                                                data-testid={`select-visibility-${user.id}`}
                                              >
                                                <SelectValue />
                                              </SelectTrigger>
                                              <SelectContent>
                                                <SelectItem value="own">Own Files Only</SelectItem>
                                                <SelectItem value="all">All Files</SelectItem>
                                                <SelectItem value="group">Group Files</SelectItem>
                                              </SelectContent>
                                            </Select>
                                          </div>
                                        </div>
                                      </div>

                                      {/* Group Assignment - Always visible, multi-select */}
                                      <div className="space-y-4">
                                        <h3 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
                                          Group Assignment
                                        </h3>
                                        <div className="space-y-2">
                                          <div className="flex items-center justify-between">
                                            <Label htmlFor={`groups-${user.id}`} className="text-sm">
                                              Groups
                                            </Label>
                                            {user.fileVisibility === 'group' && (!user.groupIds || user.groupIds.length === 0) && (
                                              <Badge variant="destructive" className="text-xs">
                                                Required for group visibility
                                              </Badge>
                                            )}
                                          </div>
                                          <div className="flex flex-wrap gap-2 mb-2">
                                            {(user.groupIds || []).map((groupId) => {
                                              const group = groups.find(g => g.id === groupId);
                                              return group ? (
                                                <Badge key={groupId} variant="secondary" data-testid={`badge-group-${groupId}-${user.id}`}>
                                                  {group.name}
                                                  <button
                                                    type="button"
                                                    onClick={() => {
                                                      const newGroupIds = (user.groupIds || []).filter(id => id !== groupId);
                                                      updateGroupsMutation.mutate({ userId: user.id, groupIds: newGroupIds });
                                                    }}
                                                    className="ml-1 hover:text-destructive"
                                                    data-testid={`button-remove-group-${groupId}-${user.id}`}
                                                  >
                                                    <X className="w-3 h-3" />
                                                  </button>
                                                </Badge>
                                              ) : null;
                                            })}
                                            {(!user.groupIds || user.groupIds.length === 0) && (
                                              <span className="text-sm text-muted-foreground">No groups assigned</span>
                                            )}
                                          </div>
                                          <Select
                                            value=""
                                            onValueChange={(groupId) => {
                                              if (groupId && !user.groupIds?.includes(groupId)) {
                                                const newGroupIds = [...(user.groupIds || []), groupId];
                                                updateGroupsMutation.mutate({ userId: user.id, groupIds: newGroupIds });
                                              }
                                            }}
                                            disabled={updateGroupsMutation.isPending}
                                          >
                                            <SelectTrigger
                                              id={`groups-${user.id}`}
                                              data-testid={`select-add-group-${user.id}`}
                                            >
                                              <SelectValue placeholder="Add to group..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                              {groups
                                                .filter(group => !user.groupIds?.includes(group.id))
                                                .map((group) => (
                                                  <SelectItem key={group.id} value={group.id}>
                                                    {group.name}
                                                  </SelectItem>
                                                ))}
                                            </SelectContent>
                                          </Select>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </CollapsibleContent>
                              </TableCell>
                            </TableRow>
                          </>
                        </Collapsible>
                      );
                    })}
                  </TableBody>
                </Table>
              </Card>
            )}
          </div>

          {/* Group Management Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-foreground">Group Management</h2>
              <Button
                onClick={() => setCreateGroupOpen(true)}
                data-testid="button-create-group"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Group
              </Button>
            </div>
            {groups.length === 0 ? (
              <Card className="p-12 text-center">
                <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No groups found</p>
                <p className="text-sm text-muted-foreground mt-2">
                  Create groups to organize users and manage file visibility
                </p>
              </Card>
            ) : (
              <Card className="p-6">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>User Count</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {groups.map((group) => {
                      const userCount = getUserCountForGroup(group.id);
                      return (
                        <TableRow key={group.id} data-testid={`row-group-${group.id}`}>
                          <TableCell className="font-medium" data-testid={`text-group-name-${group.id}`}>
                            {group.name}
                          </TableCell>
                          <TableCell
                            className="text-muted-foreground"
                            data-testid={`text-group-description-${group.id}`}
                          >
                            {group.description || "No description"}
                          </TableCell>
                          <TableCell data-testid={`text-group-users-${group.id}`}>
                            <Badge variant="secondary">{userCount} users</Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {group.createdAt
                              ? format(new Date(group.createdAt), "MMM d, yyyy")
                              : "N/A"}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="outline"
                              onClick={() => setDeleteGroupConfirm(group.id)}
                              disabled={deleteGroupMutation.isPending}
                              data-testid={`button-delete-group-${group.id}`}
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Delete
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </Card>
            )}
          </div>
        </>
      ) : (
        <AiConfigSection />
      )}

      {/* Create Group Dialog */}
      <Dialog open={createGroupOpen} onOpenChange={setCreateGroupOpen}>
        <DialogContent data-testid="dialog-create-group">
          <DialogHeader>
            <DialogTitle>Create New Group</DialogTitle>
            <DialogDescription>
              Create a group to organize users and manage file visibility
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="group-name">Group Name</Label>
              <Input
                id="group-name"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                placeholder="Enter group name"
                data-testid="input-group-name"
              />
            </div>
            <div>
              <Label htmlFor="group-description">Description (Optional)</Label>
              <Textarea
                id="group-description"
                value={newGroupDescription}
                onChange={(e) => setNewGroupDescription(e.target.value)}
                placeholder="Enter group description"
                data-testid="input-group-description"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCreateGroupOpen(false)}
              data-testid="button-cancel-group"
            >
              Cancel
            </Button>
            <Button
              onClick={() =>
                createGroupMutation.mutate({
                  name: newGroupName,
                  description: newGroupDescription || undefined,
                })
              }
              disabled={!newGroupName.trim() || createGroupMutation.isPending}
              data-testid="button-submit-group"
            >
              Create Group
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete User Confirmation */}
      <AlertDialog
        open={deleteUserConfirm !== null}
        onOpenChange={() => setDeleteUserConfirm(null)}
      >
        <AlertDialogContent data-testid="dialog-delete-user">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this user? This action cannot be undone.
              All files created by this user will remain but will no longer be associated
              with their account.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-user">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteUserConfirm && deleteUserMutation.mutate(deleteUserConfirm)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete-user"
            >
              Delete User
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Group Confirmation */}
      <AlertDialog
        open={deleteGroupConfirm !== null}
        onOpenChange={() => setDeleteGroupConfirm(null)}
      >
        <AlertDialogContent data-testid="dialog-delete-group">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Group</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this group? Users in this group will be
              unassigned and their visibility settings may need to be updated.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-group">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteGroupConfirm && deleteGroupMutation.mutate(deleteGroupConfirm)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete-group"
            >
              Delete Group
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Password Reset Confirmation */}
      <AlertDialog
        open={resetConfirmUser !== null}
        onOpenChange={(open) => !open && setResetConfirmUser(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="flex items-center gap-2 text-destructive mb-2">
              <AlertTriangle className="w-5 h-5" />
              <AlertDialogTitle>Reset User Password</AlertDialogTitle>
            </div>
            <AlertDialogDescription>
              Are you sure you want to reset the password for <span className="font-semibold text-foreground">{resetConfirmUser?.email}</span>?
              A new random password will be generated immediately.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => resetConfirmUser && resetPasswordMutation.mutate({ 
                userId: resetConfirmUser.id, 
                email: resetConfirmUser.email 
              })}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {resetPasswordMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Lock className="w-4 h-4 mr-2" />
              )}
              Reset & Generate New Password
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Password Reset Result */}
      <Dialog
        open={resetPasswordData !== null}
        onOpenChange={(open) => !open && setResetPasswordData(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2 text-green-600 mb-2">
              <CheckCircle2 className="w-5 h-5" />
              <DialogTitle>New Password Generated</DialogTitle>
            </div>
            <DialogDescription>
              The password for <span className="font-semibold text-foreground">{resetPasswordData?.email}</span> has been reset.
              Please copy the new password below and provide it to the user.
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid flex-1 gap-2 mt-4">
            <Label htmlFor="new-password">Generated Password</Label>

            <div className="relative flex items-center">
              <Input
                id="new-password"
                value={resetPasswordData?.password}
                readOnly
                className="pr-12 font-mono text-lg bg-muted/50 border-muted-foreground/20 h-12 w-full focus-visible:ring-1"
              />
              
              <Button
                size="icon"
                variant="ghost"
                type="button"
                className="absolute right-1 h-10 w-10 hover:bg-background/80 text-muted-foreground hover:text-foreground transition-all"
                onClick={() => {
                  if (resetPasswordData?.password) {
                    navigator.clipboard.writeText(resetPasswordData.password);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                    toast({ title: "Copied", description: "Password copied to clipboard" });
                  }
                }}
              >
                {copied ? (
                  <Check className="h-4 w-4 text-green-600" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
          
          <DialogFooter className="sm:justify-start mt-4">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setResetPasswordData(null)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
