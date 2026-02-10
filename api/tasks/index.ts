import type { VercelRequest, VercelResponse } from "@vercel/node";
import { apiHandler, requirePermission, type AuthenticatedRequest } from "../../_lib/apiHandler";
import { storage } from "../../_server/storage";
import { ProgramTask } from "../../../shared/schema";

export default apiHandler(
  requirePermission("read")(async (req: AuthenticatedRequest, res: VercelResponse) => {
    const { metadataFileId, seriesTitle, season } = req.query;

    if (req.method === "GET") {
      if (metadataFileId) {
        const tasks = await storage.getTasksForFile(metadataFileId as string);
        return res.json(tasks);
      }
      if (seriesTitle && season) {
        const tasks = await storage.getTasksForSeason(seriesTitle as string, parseInt(season as string));
        return res.json(tasks);
      }
      if (req.query.distinct === 'true') {
        const descriptions = await storage.getDistinctTaskDescriptions();
        return res.json(descriptions);
      }
      return res.status(400).json({ message: "Missing query parameters" });
    }

    if (req.method === "POST") {
      const { description, metadataFileId, seriesTitle, season } = req.body;
      if (!description) {
        return res.status(400).json({ message: "Description is required" });
      }

      const task = await storage.createTask({
        description,
        metadataFileId,
        seriesTitle,
        season,
        createdBy: req.user.id,
      });
      return res.status(201).json(task);
    }

    res.setHeader("Allow", ["GET", "POST"]);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  })
);
