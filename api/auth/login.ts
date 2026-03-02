import type { VercelRequest, VercelResponse } from "@vercel/node";
import bcrypt from "bcryptjs";
import { storage } from "../_server/storage.js";
import { signToken } from "../_server/jwt.js";
import { apiHandler } from "../_lib/apiHandler.js";
import { serialize } from "cookie";

export default apiHandler(async (req: VercelRequest, res: VercelResponse) => {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    const { email, password } = req.body;

    if (typeof email !== 'string' || typeof password !== 'string') {
      return res.status(400).json({ message: "Invalid input types" });
    }

    if (!email || !password) {
      return res.status(400).json({ message: "Authentication failed" });
    }

    const user = await storage.getUserByEmail(email);

    if (!user) {
      return res.status(401).json({ message: "Authentication failed" });
    }

    if (!user.password) {
      return res.status(401).json({ message: "Authentication failed" });
    }

    const isValid = await bcrypt.compare(password, user.password as string);

    if (!isValid) {
      return res.status(401).json({ message: "Authentication failed" });
    }

    if (user.status !== "active" && user.status !== "pending") {
      return res.status(423).json({
        message: "Account is not active. Please contact an administrator.",
        status: user.status
      });
    }

    // Generate JWT token
    const token = signToken(user);

    // Set HTTP-only cookie
    const cookie = serialize('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    });

    res.setHeader('Set-Cookie', cookie);

    const { password: _, ...userWithoutPassword } = user;
    res.json({
      user: userWithoutPassword,
      token, // Also send in response for Authorization header usage
    });
  } catch (error: any) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Login failed" });
  }
});
