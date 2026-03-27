import { useLocation, Link } from "wouter";
import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  FilePlus,
  Layers,
  List,
  FileText,
  LogOut,
  Shield,
  FileKey,
  CheckSquare,
  Sparkles,
  Settings,
  User,
  Camera,
  Key,
  Save,
  Loader2,
  Upload,
  Search,
  Film,
} from "lucide-react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { upload } from "@vercel/blob/client";
  
  const menuGroups = [
    {
      label: "General",
      items: [
        {
          title: "Dashboard",
          url: "/",
          icon: LayoutDashboard,
          testId: "nav-dashboard",
          adminOnly: false,
          permissionKey: "canReadMetadata",
        },
      ]
    },
    {
      label: "Metadata Manager",
      items: [
        {
          title: "Browse Series",
          url: "/browse",
          icon: List,
          testId: "nav-browse",
          adminOnly: false,
          permissionKey: "canReadMetadata",
        },
        {
          title: "Create Metadata",
          url: "/create",
          icon: FilePlus,
          testId: "nav-create",
          adminOnly: false,
          permissionKey: "canWriteMetadata",
        },
        {
          title: "Batch Create",
          url: "/batch",
          icon: Layers,
          testId: "nav-batch",
          adminOnly: false,
          permissionKey: "canWriteMetadata",
        },
        {
          title: "All Files",
          url: "/all-files",
          icon: FileText,
          testId: "nav-all-files",
          adminOnly: false,
          permissionKey: "canReadMetadata",
        },
      ]
    },
    {
      label: "License Manager",
      items: [
        {
          title: "Licenses",
          url: "/licenses",
          icon: FileKey,
          testId: "nav-licenses",
          adminOnly: false,
          permissionKey: "canReadLicenses",
        },
        {
          title: "Create License",
          url: "/create-license",
          icon: FilePlus,
          testId: "nav-create-license",
          adminOnly: false,
          permissionKey: "canWriteLicenses",
        },
      ]
    },
    {
      label: "Operations",
      items: [
        {
          title: "Tasks",
          url: "/tasks",
          icon: CheckSquare,
          testId: "nav-tasks",
          adminOnly: false,
          permissionKey: "canReadTasks",
        },
      ]
    },
    {
      label: "AI",
      items: [
        {
          title: "AI Chat (BETA)",
          url: "/ai-chat",
          icon: Sparkles,
          testId: "nav-ai-chat",
          adminOnly: false,
          permissionKey: "canUseAIChat",
        },
        {
          title: "AI Uploader",
          url: "/ai-upload",
          icon: Upload,
          testId: "nav-ai-upload",
          adminOnly: false,
          permissionKey: "canUseAI",
        },
      ]
    },
    {
      label: "KijkCijfers",
      items: [
        {
          title: "Statistics",
          url: "#",
          icon: LayoutDashboard,
          testId: "nav-stats",
          adminOnly: false,
          permissionKey: null,
          disabled: true,
        },
        {
          title: "Graphs",
          url: "#",
          icon: Layers,
          testId: "nav-graphs",
          adminOnly: false,
          permissionKey: null,
          disabled: true,
        },
      ]
    },
    {
      label: "Admin Panel",
      items: [
        {
          title: "Users & Groups",
          url: "/admin/users",
          icon: Shield,
          testId: "link-admin-users",
          adminOnly: true,
          permissionKey: null,
        },
        {
          title: "Settings",
          url: "/admin/settings",
          icon: Settings,
          testId: "link-admin-settings",
          adminOnly: true,
          permissionKey: null,
        },
      ]
    },
  ];

export function AppSidebar() {
  const [location, setLocation] = useLocation();
  const { user, logout, isLoading, isAdmin, updateProfile, isUpdatingProfile, ...permissions } = useAuth();
  const { toast } = useToast();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  
  // Profile state
  const [firstName, setFirstName] = useState(user?.firstName || "");
  const [lastName, setLastName] = useState(user?.lastName || "");
  const [profileImageUrl, setProfileImageUrl] = useState(user?.profileImageUrl || "");
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  
  // Password state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Global search
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<{ metadata: any[]; licenses: any[]; series: any[] }>({ metadata: [], licenses: [], series: [] });
  const searchTimeout = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setSearchOpen(open => !open);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (value.trim().length < 2) {
      setSearchResults({ metadata: [], licenses: [], series: [] });
      return;
    }
    searchTimeout.current = setTimeout(async () => {
      try {
        const token = localStorage.getItem("auth_token");
        const res = await fetch(`/api/search?q=${encodeURIComponent(value)}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (res.ok) setSearchResults(await res.json());
      } catch { /* ignore */ }
    }, 300);
  }, []);

  const handleLogout = async () => {
    await logout();
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsUploading(true);
      const newBlob = await upload(file.name, file, {
        access: 'private',
        handleUploadUrl: '/api/blob/upload',
        clientPayload: JSON.stringify({ type: 'avatar' }),
      });

      setProfileImageUrl(newBlob.url);
      toast({ title: "Success", description: "Avatar uploaded successfully" });
    } catch (error: any) {
      toast({ title: "Error", description: "Upload failed: " + error.message, variant: "destructive" });
    } finally {
      setIsUploading(false);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const data: any = { firstName, lastName, profileImageUrl };
      
      if (newPassword) {
        if (!currentPassword) {
          toast({ title: "Error", description: "Current password is required", variant: "destructive" });
          return;
        }
        if (newPassword !== confirmPassword) {
          toast({ title: "Error", description: "New passwords do not match", variant: "destructive" });
          return;
        }
        data.currentPassword = currentPassword;
        data.newPassword = newPassword;
      }

      await updateProfile(data);
      toast({ title: "Success", description: "Profile updated successfully" });
      
      // Reset password fields
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setIsSettingsOpen(false);
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to update profile", variant: "destructive" });
    }
  };

  const getUserInitials = () => {
    if (user?.firstName && user?.lastName) {
      return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
    }
    if (user?.email) {
      return user.email[0].toUpperCase();
    }
    return "U";
  };

  const getProxiedUrl = (url: string | null | undefined) => {
    if (!url) return undefined;
    if (url.includes('vercel-storage.com')) {
      return `/api/blob/view?url=${encodeURIComponent(url)}`;
    }
    return url;
  };
  
  const filteredGroups = menuGroups.map(group => ({
    ...group,
    items: group.items.filter(item => {
      if (item.adminOnly && !isAdmin) return false;
      if (isLoading) return true;
      if (item.permissionKey && !isAdmin) {
        return !!(permissions as any)[item.permissionKey];
      }
      return true;
    })
  })).filter(group => group.items.length > 0);

  return (
    <Sidebar>
      <SidebarContent>
        <div className="px-4 py-6">
          <h2 className="text-xl font-bold tracking-tight text-primary">ONS Portal</h2>
          <p className="text-xs text-muted-foreground mt-1 font-medium">Broadcast Management System</p>
        </div>

        <div className="px-3 mb-2">
          <Button
            variant="outline"
            className="w-full justify-start text-muted-foreground text-sm h-9 gap-2"
            onClick={() => setSearchOpen(true)}
          >
            <Search className="w-4 h-4" />
            Search...
            <kbd className="ml-auto pointer-events-none text-xs font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">Ctrl+K</kbd>
          </Button>
        </div>

        <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
          <DialogContent className="overflow-hidden p-0 shadow-lg">
            <Command shouldFilter={false} className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground">
          <CommandInput placeholder="Search metadata, licenses, series..." value={searchQuery} onValueChange={handleSearchChange} />
          <CommandList className="max-h-[300px]">
            <CommandEmpty>{searchQuery.length < 2 ? "Type at least 2 characters..." : "No results found."}</CommandEmpty>
            {searchResults.metadata.length > 0 && (
              <CommandGroup heading="Metadata">
                {searchResults.metadata.map((f: any) => (
                  <CommandItem key={f.id} onSelect={() => { setSearchOpen(false); setLocation(`/view/${f.id}`); }}>
                    <FileText className="w-4 h-4 mr-2 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <span className="font-medium">{f.title}</span>
                      {f.season && <span className="text-muted-foreground text-xs ml-2">S{f.season}E{f.episode}</span>}
                    </div>
                    <span className="text-xs font-mono text-muted-foreground">{f.id}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {searchResults.licenses.length > 0 && (
              <CommandGroup heading="Licenses">
                {searchResults.licenses.map((l: any) => (
                  <CommandItem key={l.id} onSelect={() => { setSearchOpen(false); setLocation(`/licenses/${l.id}`); }}>
                    <FileKey className="w-4 h-4 mr-2 text-muted-foreground" />
                    <span className="font-medium">{l.name}</span>
                    {l.distributor && <span className="text-muted-foreground text-xs ml-2">{l.distributor}</span>}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {searchResults.series.length > 0 && (
              <CommandGroup heading="Series">
                {searchResults.series.map((s: any) => (
                  <CommandItem key={s.id} onSelect={() => { setSearchOpen(false); setLocation(`/browse/${encodeURIComponent(s.title)}`); }}>
                    <Film className="w-4 h-4 mr-2 text-muted-foreground" />
                    <span className="font-medium">{s.title}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
            </Command>
          </DialogContent>
        </Dialog>
        
        {filteredGroups.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel className="text-xs uppercase tracking-widest font-semibold opacity-70 px-4 mb-2">
              {group.label}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={location === item.url}
                      data-testid={item.testId}
                      disabled={(item as any).disabled}
                      className={cn(
                        "transition-all duration-200",
                        (item as any).disabled && "opacity-50 cursor-not-allowed grayscale"
                      )}
                    >
                      <Link href={item.url} onClick={(e) => (item as any).disabled && e.preventDefault()}>
                        <item.icon className="w-4 h-4" />
                        <span>{item.title}</span>
                        {(item as any).disabled && (
                          <span className="ml-auto text-xs bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                            Soon
                          </span>
                        )}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter>
        <div className="p-4 border-t space-y-3">
          <button 
            onClick={() => {
              setFirstName(user?.firstName || "");
              setLastName(user?.lastName || "");
              setProfileImageUrl(user?.profileImageUrl || "");
              setIsSettingsOpen(true);
            }}
            className="flex items-center gap-3 w-full text-left p-2 rounded-lg hover:bg-muted transition-colors group"
          >
            <Avatar className="w-10 h-10 border border-border group-hover:border-primary/30 transition-colors">
              <AvatarImage src={getProxiedUrl(user?.profileImageUrl)} className="aspect-square object-cover" />
              <AvatarFallback>{getUserInitials()}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate flex items-center gap-1">
                {user?.firstName && user?.lastName
                  ? `${user.firstName} ${user.lastName}`
                  : user?.email || "User"}
                <Settings className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </p>
              {user?.email && (
                <p className="text-xs text-muted-foreground truncate">
                  {user.email}
                </p>
              )}
            </div>
          </button>

          <Button
            variant="outline"
            size="sm"
            className="w-full h-9"
            onClick={handleLogout}
            data-testid="button-logout"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Log Out
          </Button>
        </div>

        <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Settings className="w-5 h-5" />
                User Settings
              </DialogTitle>
              <DialogDescription>
                Update your profile information and account security.
              </DialogDescription>
            </DialogHeader>
            
            <form onSubmit={handleUpdateProfile} className="space-y-6 pt-4">
              <div className="space-y-4">
                <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2 uppercase tracking-wider">
                  <User className="w-4 h-4" /> Personal Information
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">First Name</Label>
                    <Input 
                      id="firstName" 
                      value={firstName} 
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="John"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Last Name</Label>
                    <Input 
                      id="lastName" 
                      value={lastName} 
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder="Doe"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="avatar" className="flex items-center gap-2">
                    <Camera className="w-4 h-4" /> Profile Image
                  </Label>
                  <div className="flex items-center gap-4">
                    <Avatar className="w-16 h-16 border-2 border-primary/20">
                      <AvatarImage src={getProxiedUrl(profileImageUrl)} className="aspect-square object-cover" />
                      <AvatarFallback className="text-xl">{getUserInitials()}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 space-y-2">
                      <input 
                        type="file" 
                        ref={fileInputRef}
                        onChange={handleFileUpload}
                        className="hidden"
                        accept="image/*"
                      />
                      <Button 
                        type="button" 
                        variant="outline" 
                        size="sm"
                        className="w-full h-9"
                        disabled={isUploading}
                        onClick={() => fileInputRef.current?.click()}
                      >
                        {isUploading ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Uploading...
                          </>
                        ) : (
                          <>
                            <Upload className="w-4 h-4 mr-2" />
                            Upload New Image
                          </>
                        )}
                      </Button>
                      <p className="text-xs text-muted-foreground">
                        Supports JPG, PNG, GIF. Max 4.5MB for serverless.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2 uppercase tracking-wider">
                  <Key className="w-4 h-4" /> Change Password
                </h4>
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="currentPass">Current Password</Label>
                    <Input 
                      id="currentPass" 
                      type="password" 
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="Required to change password"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="newPass">New Password</Label>
                    <Input 
                      id="newPass" 
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Minimum 8 characters"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirmPass">Confirm New Password</Label>
                    <Input 
                      id="confirmPass" 
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Repeat new password"
                    />
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button 
                  type="submit" 
                  className="w-full" 
                  disabled={isUpdatingProfile}
                >
                  {isUpdatingProfile ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Save Changes
                    </>
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </SidebarFooter>
    </Sidebar>
  );
}
