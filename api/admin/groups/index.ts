import type { VercelRequest, VercelResponse } from "@vercel/node";
import { storage } from "../../../shared/storage.js";
import { apiHandler, requireAdmin, type AuthenticatedRequest } from "../../_lib/apiHandler.js";

export default apiHandler(
  requireAdmin(async (req: AuthenticatedRequest, res: VercelResponse) => {
    if (req.method === "GET") {
      try {
        const groups = await storage.getAllGroups();
        res.json({ groups });
      } catch (error) {
        console.error("Error listing groups:", error);
        res.status(500).json({ message: "Failed to list groups" });
      }
      return;
    }

    if (req.method === "POST") {
      try {
        const { name } = req.body;

        if (!name || typeof name !== "string") {
          return res.status(400).json({ message: "Group name is required" });
        }

        const group = await storage.createGroup({ name });
        res.json(group);
      } catch (error) {
        console.error("Error creating group:", error);
        res.status(500).json({ message: "Failed to create group" });
      }
      return;
    }

    return res.status(405).json({ message: "Method not allowed" });
  })
);
