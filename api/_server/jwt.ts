import jwt from "jsonwebtoken";
import type { User } from "../_shared/schema.js";

const JWT_SECRET = process.env.JWT_SECRET || process.env.SESSION_SECRET!;
const JWT_EXPIRES_IN = "7d"; // 7 days to match old session TTL

export type JWTPayload = {
  userId: string;
  email: string;
  iat?: number;
  exp?: number;
};

export function signToken(user: User): string {
  const payload: JWTPayload = {
    userId: user.id,
    email: user.email,
  };

  // @ts-ignore - jsonwebtoken types can be tricky in ESM
  const sign = (jwt.sign || (jwt as any).default?.sign);
  if (typeof sign === 'function') {
    return sign(payload, JWT_SECRET, {
      expiresIn: JWT_EXPIRES_IN,
    });
  }
  
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  });
}

export function verifyToken(token: string): JWTPayload | null {
  try {
    // @ts-ignore
    const verify = (jwt.verify || (jwt as any).default?.verify);
    if (typeof verify === 'function') {
      return verify(token, JWT_SECRET) as JWTPayload;
    }
    return jwt.verify(token, JWT_SECRET) as JWTPayload;
  } catch (error) {
    console.error("JWT verification failed:", error);
    return null;
  }
}

export function extractTokenFromHeader(authHeader: string | undefined): string | null {
  if (!authHeader) {
    return null;
  }

  // Support both "Bearer <token>" and raw token
  if (authHeader.startsWith("Bearer ")) {
    return authHeader.substring(7);
  }

  return authHeader;
}

export function extractTokenFromCookie(cookieHeader: string | undefined): string | null {
  if (!cookieHeader) {
    return null;
  }

  // Parse cookie string to find auth_token
  const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
    const [key, value] = cookie.trim().split('=');
    acc[key] = value;
    return acc;
  }, {} as Record<string, string>);

  return cookies['auth_token'] || null;
}
