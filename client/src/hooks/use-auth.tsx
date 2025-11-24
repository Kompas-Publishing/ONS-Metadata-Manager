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

  const isPending = user?.status === "pending";
  const isAuthenticated = !!user && user.status === "active";
  const isAdmin = user?.isAdmin === 1;

  return {
    user,
    isLoading,
    isPending,
    isAuthenticated,
    isAdmin,
    login,
    logout,
    register,
  };
}
