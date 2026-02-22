import type { VercelResponse } from "@vercel/node";
import { executeChatProposal } from "../../_server/ai-chat.js";
import { apiHandler, requirePermission, type AuthenticatedRequest } from "../../../_lib/apiHandler.js";

export default apiHandler(
  requirePermission("aiChat")(async (req: AuthenticatedRequest, res: VercelResponse) => {
    if (req.method !== "POST") {
      return res.status(405).json({ message: "Method not allowed" });
    }

    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const result = await executeChatProposal(req.body, req.permissions!, userId);
      return res.json(result);
    } catch (error: any) {
      console.error("Error executing AI chat proposal:", error);
      return res.status(500).json({ message: error.message || "Failed to execute proposal" });
    }
  })
);
