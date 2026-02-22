import type { VercelResponse } from "@vercel/node";
import { runAiChat } from "../../_server/ai-chat.js";
import { apiHandler, requirePermission, type AuthenticatedRequest } from "../../_lib/apiHandler.js";

export default apiHandler(
  requirePermission("aiChat")(async (req: AuthenticatedRequest, res: VercelResponse) => {
    if (req.method !== "POST") {
      return res.status(405).json({ message: "Method not allowed" });
    }

    try {
      const messages = Array.isArray(req.body?.messages) ? req.body.messages : [];
      const debug = Boolean(req.body?.debug);
      const result = await runAiChat(messages, req.permissions!, { debug });
      return res.json(result);
    } catch (error: any) {
      console.error("Error in AI chat:", error);
      return res.status(500).json({ message: error.message || "AI chat failed" });
    }
  })
);
