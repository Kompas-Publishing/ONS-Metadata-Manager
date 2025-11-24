import type { VercelRequest, VercelResponse } from "@vercel/node";
import bcrypt from "bcryptjs";
import { storage } from "../../server/storage";
import { apiHandler } from "../_lib/apiHandler";

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
      canRead: 0,
      canWrite: 0,
      canEdit: 0,
      fileVisibility: "own",
      isAdmin: 0,
    });

    res.json({
      message: "Registration successful. Please wait for admin approval.",
      user: { id: user.id, email: user.email, status: user.status },
    });
  } catch (error: any) {
    console.error("Registration error:", error);
    res.status(500).json({ message: "Registration failed" });
  }
});
