import { useLocation, Link } from "wouter";
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
  } from "lucide-react";
  
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
  const { user, logout, isLoading, isAdmin, ...permissions } = useAuth();

  const handleLogout = async () => {
    await logout();
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
            Metadata Manager
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
        <div className="p-4 border-t">
          <div className="flex items-center gap-3 mb-3">
            <Avatar className="w-10 h-10">
              <AvatarImage src={user?.profileImageUrl || undefined} />
              <AvatarFallback>{getUserInitials()}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">
                {user?.firstName && user?.lastName
                  ? `${user.firstName} ${user.lastName}`
                  : user?.email || "User"}
              </p>
              {user?.email && (
                <p className="text-xs text-muted-foreground truncate">
                  {user.email}
                </p>
              )}
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={handleLogout}
            data-testid="button-logout"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Log Out
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
