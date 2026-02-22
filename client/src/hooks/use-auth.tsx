import { useQuery, useMutation } from "@tanstack/react-query";
import type { User } from "@shared/schema";
import { queryClient, apiRequest } from "@/lib/queryClient";

export function useAuth() {
  const { data: user, isLoading } = useQuery<User>({
    queryKey: ["/api/auth/user"],
    retry: false,
  });

  const loginMutation = useMutation({
    mutationFn: async ({ email, password }: { email: string; password: string }) => {
      const response = await apiRequest("POST", "/api/auth/login", { email, password });
      return response.json();
    },
    onSuccess: (data) => {
      // Store JWT token in localStorage if provided
      if (data.token) {
        localStorage.setItem('auth_token', data.token);
      }
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/auth/logout");
    },
    onSuccess: () => {
      // Clear JWT token from localStorage
      localStorage.removeItem('auth_token');
      queryClient.invalidateQueries();
      window.location.href = "/login";
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (data: {
      email: string;
      password: string;
      firstName: string;
      lastName: string;
    }) => {
      const response = await apiRequest("POST", "/api/auth/register", data);
      return response.json();
    },
  });

  const updateProfileMutation = useMutation({
    mutationFn: async (data: {
      firstName?: string;
      lastName?: string;
      profileImageUrl?: string;
      currentPassword?: string;
      newPassword?: string;
    }) => {
      const response = await apiRequest("PATCH", "/api/auth/user", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
    },
  });

  const login = async (email: string, password: string) => {
    return loginMutation.mutateAsync({ email, password });
  };

  const logout = async () => {
    return logoutMutation.mutateAsync();
  };

  const register = async (data: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
  }) => {
    return registerMutation.mutateAsync(data);
  };

  const updateProfile = async (data: Parameters<typeof updateProfileMutation.mutateAsync>[0]) => {
    return updateProfileMutation.mutateAsync(data);
  };

  const isPending = user?.status === "pending";
  const isAuthenticated = !!user && user.status === "active";
  const isAdmin = user?.isAdmin === 1;

  // Granular permission helpers
  const canReadMetadata = isAdmin || (isAuthenticated && user?.canReadMetadata === 1);
  const canWriteMetadata = isAdmin || (isAuthenticated && user?.canWriteMetadata === 1);
  const canReadLicenses = isAdmin || (isAuthenticated && user?.canReadLicenses === 1);
  const canWriteLicenses = isAdmin || (isAuthenticated && user?.canWriteLicenses === 1);
  const canReadTasks = isAdmin || (isAuthenticated && user?.canReadTasks === 1);
  const canWriteTasks = isAdmin || (isAuthenticated && user?.canWriteTasks === 1);
  const canUseAI = isAdmin || (isAuthenticated && user?.canUseAI === 1);
  const canUseAIChat = isAdmin || (isAuthenticated && user?.canUseAIChat === 1);

  return {
    user,
    isLoading,
    isPending,
    isAuthenticated,
    isAdmin,
    canReadMetadata,
    canWriteMetadata,
    canReadLicenses,
    canWriteLicenses,
    canReadTasks,
    canWriteTasks,
    canUseAI,
    canUseAIChat,
    login,
    logout,
    register,
    updateProfile,
    isUpdatingProfile: updateProfileMutation.isPending,
  };
}
