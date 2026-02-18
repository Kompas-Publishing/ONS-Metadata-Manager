import type { VercelResponse } from "@vercel/node";
import { storage } from "../_server/storage.js";
import { withCors, requirePermission, type AuthenticatedRequest } from "../_lib/apiHandler.js";

async function handler(req: AuthenticatedRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    const proposal = req.body;
    const { type, action, data } = proposal;

    if (type === "license") {
      if (action === "create") {
        const license = await storage.createLicense(data);
        return res.json({ message: "License created successfully", id: license.id });
      } else if (action === "update") {
        const license = await storage.updateLicense(data.id, data);
        return res.json({ message: "License updated successfully", id: license?.id });
      }
    } else if (type === "metadata") {
      if (action === "create") {
        const nextId = await storage.consumeNextId();
        const metadataToCreate = {
          ...data,
          duration: data.duration || "00:00:00",
          contentType: data.contentType || "Long Form",
        };
        const file = await storage.createMetadataFile(metadataToCreate, nextId, req.permissions!);
        return res.json({ message: "Metadata file created successfully", id: file.id });
      } else if (action === "update") {
        const file = await storage.updateMetadataFile(data.id, data, req.permissions!);
        return res.json({ message: "Metadata file updated successfully", id: file?.id });
      }
    }

    return res.status(400).json({ message: "Invalid proposal or action" });
  } catch (error: any) {
    console.error("Error executing proposal:", error);
    return res.status(500).json({ message: error.message || "Failed to execute proposal" });
  }
}

export default withCors(requirePermission("write")(handler));
