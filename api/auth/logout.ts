import type { VercelRequest, VercelResponse } from "@vercel/node";
import { apiHandler } from "../_lib/apiHandler";
import { serialize } from "cookie";

export default apiHandler(async (req: VercelRequest, res: VercelResponse) => {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  // Clear the auth cookie
  const cookie = serialize('auth_token', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: -1, // Expire immediately
    path: '/',
  });

  res.setHeader('Set-Cookie', cookie);
  res.json({ message: "Logged out successfully" });
});
