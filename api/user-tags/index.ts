import type { VercelRequest, VercelResponse} from "@vercel/node";
import { storage } from "../_server/storage.js";
import { apiHandler, requireAuth, type AuthenticatedRequest } from "../_lib/apiHandler.js";
import { insertUserDefinedTagSchema } from "../_shared/schema.js";

export default apiHandler(
  requireAuth(async (req: AuthenticatedRequest, res: VercelResponse) => {
    if (req.method !== "POST") {
      return res.status(405).json({ message: "Method not allowed" });
    }

    try {
      const userId = req.user!.id;
      const validation = insertUserDefinedTagSchema.safeParse({
        ...req.body,
        userId,
      });

      if (!validation.success) {
        return res.status(400).json({
          message: "Validation failed",
          errors: validation.error.errors,
        });
      }

      const tag = await storage.createUserTag(validation.data);
      res.json(tag);
    } catch (error) {
      console.error("Error creating user tag:", error);
      res.status(500).json({ message: "Failed to create user tag" });
    }
  })
);
