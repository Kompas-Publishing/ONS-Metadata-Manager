import type { VercelRequest, VercelResponse } from "@vercel/node";
import { storage } from "../../../_server/storage.js";
import { requireAdmin, withCors, type AuthenticatedRequest } from "../../../_lib/apiHandler.js";

async function handler(req: AuthenticatedRequest, res: VercelResponse) {
  if (req.method === "GET") {
    try {
      const keys = ["ai_provider", "ai_model", "ai_api_key"];
      const settingsList = await storage.getSettingsByKeys(keys);
      
      // Mask the API key
      const sanitized = settingsList.map(s => {
        if (s.key === "ai_api_key" && s.value) {
          const val = s.value;
          if (val.length > 8) {
            return { ...s, value: val.substring(0, 4) + "****" + val.substring(val.length - 4) };
          }
          return { ...s, value: "****" };
        }
        return s;
      });
      
      return res.status(200).json({ settings: sanitized });
    } catch (error) {
      console.error("Error fetching AI settings:", error);
      return res.status(500).json({ message: "Failed to fetch AI settings" });
    }
  }

  if (req.method === "POST") {
    try {
      const { provider, model, apiKey } = req.body;
      
      if (provider) await storage.setSetting("ai_provider", provider);
      if (model) await storage.setSetting("ai_model", model);
      if (apiKey && !apiKey.includes("****")) {
        await storage.setSetting("ai_api_key", apiKey);
      }
      
      return res.status(200).json({ message: "AI settings updated successfully" });
    } catch (error) {
      console.error("Error updating AI settings:", error);
      return res.status(500).json({ message: "Failed to update AI settings" });
    }
  }

  return res.status(405).json({ message: "Method not allowed" });
}

export default withCors(requireAdmin(handler));
