import { useLocation, Link } from "wouter";
import React, { useState, useRef } from "react";
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
  } from "lucide-react";
import { upload } from "@vercel/blob/client";
  
  const allMenuItems = [
    {
      title: "Dashboard",
      url: "/",
      icon: LayoutDashboard,
      testId: "nav-dashboard",
      adminOnly: false,
      permissionKey: "canReadMetadata",
    },
    {
      title: "Task List",
      url: "/tasks",
      icon: CheckSquare,
      testId: "nav-tasks",
      adminOnly: false,
      permissionKey: "canReadTasks",
    },
    {
      title: "AI Upload",
      url: "/ai-upload",
      icon: Sparkles,
      testId: "nav-ai-upload",
      adminOnly: false,
      permissionKey: "canUseAI",
    },
    {
      title: "License Manager",    url: "/licenses",
    icon: FileKey,
    testId: "nav-licenses",
    adminOnly: false,
    permissionKey: "canReadLicenses",
  },
  {
    title: "Create File",
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
    title: "Browse Series",
    url: "/browse",
    icon: List,
    testId: "nav-browse",
    adminOnly: false,
    permissionKey: "canReadMetadata",
  },
  {
    title: "All Files",
    url: "/all-files",
    icon: FileText,
    testId: "nav-all-files",
    adminOnly: false,
    permissionKey: "canReadMetadata",
  },
  {
    title: "Admin Panel",
    url: "/admin",
    icon: Shield,
    testId: "link-admin",
    adminOnly: true,
    permissionKey: null,
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
        addRandomSuffix: true,
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
  
  const menuItems = allMenuItems.filter((item) => {
    // Filter out admin-only items for non-admins
    if (item.adminOnly && !isAdmin) {
      return false;
    }
    
    // Don't apply filters during auth loading to prevent flicker
    if (isLoading) {
      return true;
    }
    
    // Check granular permissions if defined
    if (item.permissionKey && !isAdmin) {
      return !!(permissions as any)[item.permissionKey];
    }
    
    return true;
  });

  return (
    <Sidebar>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-base font-semibold px-4 py-4">
            ONS Broadcast Portal
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton
                    asChild
                    isActive={location === item.url}
                    data-testid={item.testId}
                  >
                    <Link href={item.url}>
                      <item.icon className="w-4 h-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
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
              <AvatarImage src={getProxiedUrl(user?.profileImageUrl)} />
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
                      <AvatarImage src={getProxiedUrl(profileImageUrl)} />
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
                      <p className="text-[10px] text-muted-foreground">
                        Supports JPG, PNG, GIF. Max 4.5MB for serverless.
                      </p>
                    </div>
                  </div>
                  <Input 
                    id="avatar-url" 
                    value={profileImageUrl} 
                    onChange={(e) => setProfileImageUrl(e.target.value)}
                    placeholder="Or paste an image URL..."
                    className="mt-2 h-8 text-xs font-mono"
                  />
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
