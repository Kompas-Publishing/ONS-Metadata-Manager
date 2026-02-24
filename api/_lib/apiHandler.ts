import type { VercelRequest, VercelResponse } from "@vercel/node";
import { storage } from "../_server/storage.js";
import { verifyToken, extractTokenFromHeader, extractTokenFromCookie, type JWTPayload } from "../_server/jwt.js";
import type { User } from "../_shared/schema.js";
import { getUserPermissions, requirePermission as checkPermission } from "../_server/permissions.js";
import type { UserPermissions, PermissionFeature, PermissionAction } from "../_shared/types.js";

export interface AuthenticatedRequest extends VercelRequest {
  user?: User;
  userId?: string;
  permissions?: UserPermissions;
}

export type ApiHandler = (req: AuthenticatedRequest, res: VercelResponse) => Promise<void | VercelResponse> | void | VercelResponse;

export function corsMiddleware(req: AuthenticatedRequest, res: VercelResponse) {
  const origin = req.headers.origin;
  const allowedOrigins = ['https://metadata.onstv.nl'];
  
  let currentOrigin = allowedOrigins[0];
  // Allow primary domain and any Vercel preview URLs
  if (origin && (allowedOrigins.includes(origin) || origin.endsWith('.vercel.app') || origin.startsWith('http://localhost'))) {
    currentOrigin = origin;
  }

  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', currentOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );
}

export async function authenticate(req: AuthenticatedRequest): Promise<User | null> {
  // Try to get token from Authorization header first, then from cookie
  let token = extractTokenFromHeader(req.headers.authorization as string);

  if (!token) {
    token = extractTokenFromCookie(req.headers.cookie);
  }

  if (!token) {
    return null;
  }

  const payload: JWTPayload | null = verifyToken(token);

  if (!payload) {
    return null;
  }

  try {
    const user = await storage.getUserById(payload.userId);
    if (!user) {
      return null;
    }

    req.user = user;
    req.userId = user.id;
    return user;
  } catch (error) {
    console.error('Error fetching user:', error);
    return null;
  }
}

export function requireAuth(handler: ApiHandler): ApiHandler {
  return async (req: AuthenticatedRequest, res: VercelResponse) => {
    const user = await authenticate(req);

    if (!user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (user.status !== "active") {
      return res.status(423).json({ message: "Account is not active. Please contact an administrator." });
    }

    return handler(req, res);
  };
}

export function requirePermission(feature: PermissionFeature, action: PermissionAction = "read") {
  return (handler: ApiHandler): ApiHandler => {
    return async (req: AuthenticatedRequest, res: VercelResponse) => {
      const user = await authenticate(req);

      if (!user) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { allowed, permissions, reason } = await checkPermission(user.id, feature, action);

      if (!allowed) {
        const statusCode = permissions?.user.status === "pending" ? 423 : 403;
        return res.status(statusCode).json({ message: reason });
      }

      req.permissions = permissions || undefined;
      return handler(req, res);
    };
  };
}

export function requireAdmin(handler: ApiHandler): ApiHandler {
  return async (req: AuthenticatedRequest, res: VercelResponse) => {
    const user = await authenticate(req);

    if (!user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (user.isAdmin !== 1) {
      return res.status(403).json({ message: "Admin access required" });
    }

    const permissions = await getUserPermissions(user.id);
    req.permissions = permissions || undefined;

    return handler(req, res);
  };
}

export function withCors(handler: ApiHandler): ApiHandler {
  return async (req: AuthenticatedRequest, res: VercelResponse) => {
    corsMiddleware(req, res);

    if (req.method === 'OPTIONS') {
      res.status(200).end();
      return;
    }

    return handler(req, res);
  };
}

/**
 * Validates that a URL belongs to Vercel Blob storage.
 * This prevents SSRF attacks where a malicious URL could be used to leak sensitive tokens.
 */
export function isValidBlobUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') return false;
    
    const hostname = parsed.hostname;
    // Pentest Fix (Refined): Allow any legitimate Vercel Blob storage subdomain.
    // This includes both .public.blob.vercel-storage.com and .blob.vercel-storage.com (for private blobs).
    return (
      hostname === "blob.vercel-storage.com" ||
      hostname.endsWith(".blob.vercel-storage.com")
    );
  } catch {
    return false;
  }
}

export function apiHandler(handler: ApiHandler): ApiHandler {
  return withCors(handler);
}
