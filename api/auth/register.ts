import type { VercelRequest, VercelResponse } from "@vercel/node";
import bcrypt from "bcryptjs";
import { storage } from "../../shared/storage.js";
import { apiHandler } from "../_lib/apiHandler.js";
import { signToken } from "../../shared/jwt.js";
import { serialize } from "cookie";

export default apiHandler(async (req: VercelRequest, res: VercelResponse) => {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    const { email, password, firstName, lastName } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const existingUser = await storage.getUserByEmail(email);
    if (existingUser) {
      return res.status(400).json({ message: "Email already registered" });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await storage.createUser({
      email,
      password: hashedPassword,
      firstName: firstName || null,
      lastName: lastName || null,
      authProvider: "local",
      status: "pending",
      canReadMetadata: 1,
      canWriteMetadata: 0,
      canReadLicenses: 1,
      canWriteLicenses: 0,
      canReadTasks: 1,
      canWriteTasks: 0,
      canUseAI: 0,
      fileVisibility: "own",
      isAdmin: 0,
    });

    // Generate JWT token for auto-login
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

    res.json({
      message: "Registration successful. Please wait for admin approval.",
      user: { id: user.id, email: user.email, status: user.status },
      token, // Also send in response
    });
  } catch (error: any) {
    console.error("Registration error:", error);
    res.status(500).json({ message: "Registration failed" });
  }
});
