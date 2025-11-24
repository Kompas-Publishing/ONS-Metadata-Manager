import type { VercelRequest, VercelResponse } from "@vercel/node";
import { apiHandler, requireAuth, type AuthenticatedRequest } from "../_lib/apiHandler";

export default apiHandler(
  requireAuth(async (req: AuthenticatedRequest, res: VercelResponse) => {
    if (req.method !== "GET") {
      return res.status(405).json({ message: "Method not allowed" });
    }

    try {
      const user = req.user!;
      const { password, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  })
);
