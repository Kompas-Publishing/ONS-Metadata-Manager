import type { VercelRequest, VercelResponse } from "@vercel/node";
import { storage } from "../../../../../../server/storage";
import { apiHandler, requirePermission, type AuthenticatedRequest } from "../../../../../_lib/apiHandler.js";
import { transformFileForDownload, buildSeriesXml, buildMetadataXlsx } from "../../../../../_lib/downloadUtils.js";
import * as XLSX from "xlsx";

export default apiHandler(
  requirePermission("read")(async (req: AuthenticatedRequest, res: VercelResponse) => {
    if (req.method !== "GET") {
      return res.status(405).json({ message: "Method not allowed" });
    }

    try {
      const { title, season, format } = req.query;

      if (!title || typeof title !== "string") {
        return res.status(400).json({ message: "Invalid title" });
      }

      if (!season || typeof season !== "string") {
        return res.status(400).json({ message: "Invalid season" });
      }

      if (!format || typeof format !== "string") {
        return res.status(400).json({ message: "Invalid format" });
      }

      const seasonNum = parseInt(season);
      if (isNaN(seasonNum)) {
        return res.status(400).json({ message: "Season must be a number" });
      }

      const files = await storage.getMetadataBySeason(title, seasonNum, req.permissions!);

      if (!files || files.length === 0) {
        return res.status(404).json({ message: "No files found for this season" });
      }

      const transformedFiles = files.map(transformFileForDownload);

      if (format === "xml") {
        const xml = buildSeriesXml(transformedFiles, 'season');

        const filename = `${title.replace(/[^a-z0-9]/gi, "_").toLowerCase()}_s${season}`;
        res.setHeader("Content-Type", "application/xml");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="${filename}.xml"`,
        );
        res.send(xml);
      } else if (format === "xlsx") {
        const wb = buildMetadataXlsx(files);
        const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

        const filename = `${title.replace(/[^a-z0-9]/gi, "_").toLowerCase()}_s${season}`;
        res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="${filename}.xlsx"`,
        );
        res.send(buffer);
      } else {
        const filename = `${title.replace(/[^a-z0-9]/gi, "_").toLowerCase()}_s${season}`;
        res.setHeader("Content-Type", "application/json");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="${filename}.json"`,
        );
        res.json(transformedFiles);
      }
    } catch (error) {
      console.error("Error downloading season:", error);
      res.status(500).json({ message: "Failed to download season" });
    }
  })
);
