import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    
    // Handle 423 Locked status (pending approval)
    if (res.status === 423) {
      toast({
        title: "Account Pending Approval",
        description: "Your account is awaiting administrator approval. Please contact an administrator to activate your account.",
        variant: "destructive",
      });
    }
    
    throw new Error(`${res.status}: ${text}`);
  }
}

function getAuthHeaders(): HeadersInit {
  const headers: HeadersInit = {};

  // Try to get token from localStorage (for Authorization header)
  const token = localStorage.getItem('auth_token');
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return headers;
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const authHeaders = getAuthHeaders();
  const headers = {
    ...authHeaders,
    ...(data ? { "Content-Type": "application/json" } : {}),
  };

  const res = await fetch(url, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include", // Still send cookies as fallback
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const authHeaders = getAuthHeaders();
    
    // Construct URL from queryKey, handling potential objects for query params
    let url = queryKey[0] as string;
    if (queryKey.length > 1 && typeof queryKey[1] === 'object') {
      const params = new URLSearchParams();
      Object.entries(queryKey[1] as Record<string, any>).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.append(key, value.toString());
        }
      });
      const queryString = params.toString();
      if (queryString) {
        url += (url.includes('?') ? '&' : '?') + queryString;
      }
    } else if (queryKey.length > 1) {
      url = queryKey.join("/");
    }

    const res = await fetch(url, {
      headers: authHeaders,
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchOnWindowFocus: true,
      staleTime: 30 * 1000, // 30 seconds
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
