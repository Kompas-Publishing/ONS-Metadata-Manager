import type { VercelResponse } from "@vercel/node";
import { storage } from "../../_server/storage.js";
import { apiHandler, type AuthenticatedRequest, authenticate } from "../../_lib/apiHandler.js";
import { getUserPermissions } from "../../_server/permissions.js";

export default apiHandler(async (req: AuthenticatedRequest, res: VercelResponse) => {
  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  await authenticate(req);
  const userId = req.user?.id;
  const fileId = req.query.id as string;

  if (!fileId) return res.status(400).json({ message: "Invalid file ID" });
  if (!userId) return res.status(401).json({ message: "Unauthorized" });

  const permissions = await getUserPermissions(userId);
  if (!permissions || !permissions.permissions.tasks.read) return res.status(403).json({ message: "No read permission for tasks" });

  try {
    const tasks = await storage.getTasksByFileId(fileId, permissions);
    return res.json(tasks);
  } catch (error) {
    console.error("Error fetching file tasks:", error);
    return res.status(500).json({ message: "Failed to fetch file tasks" });
  }
});
