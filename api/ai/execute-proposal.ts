import type { VercelResponse } from "@vercel/node";
import { storage } from "../_server/storage";
import { withCors, requirePermission, type AuthenticatedRequest } from "../_lib/apiHandler";

async function handler(req: AuthenticatedRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    const proposal = req.body;
    const { type, action, data } = proposal;
    const userId = (req as any).userId;

    if (type === "license") {
      if (action === "create") {
        const licenseData = { ...data };
        if (licenseData.licenseStart) licenseData.licenseStart = new Date(licenseData.licenseStart);
        if (licenseData.licenseEnd) licenseData.licenseEnd = new Date(licenseData.licenseEnd);
        
        const license = await storage.createLicense(licenseData);
        
        // Generate linked content (metadata drafts) if items are listed
        if (data.content_items && Array.isArray(data.content_items)) {
          for (const item of data.content_items) {
            if (item.episodes > 0) {
              const seasonNum = item.season || 1;
              await storage.generateLicenseDrafts({
                licenseId: license.id,
                seriesTitle: item.title,
                seasonStart: seasonNum,
                seasonEnd: seasonNum,
                episodesPerSeason: item.episodes
              }, userId);
            }
          }
        }
        
        return res.json({ message: "License and linked content created successfully", id: license.id });
      } else if (action === "update") {
        const licenseData = { ...data };
        if (licenseData.licenseStart) licenseData.licenseStart = new Date(licenseData.licenseStart);
        if (licenseData.licenseEnd) licenseData.licenseEnd = new Date(licenseData.licenseEnd);
        
        const license = await storage.updateLicense(data.id, licenseData);
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

export const config = {
  maxDuration: 300,
};

export default withCors(requirePermission("ai")(handler));
