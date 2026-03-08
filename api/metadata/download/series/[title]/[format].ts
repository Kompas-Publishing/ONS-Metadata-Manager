import type { VercelRequest, VercelResponse } from "@vercel/node";
import { storage } from "../../../../_server/storage";
import { apiHandler, requirePermission, type AuthenticatedRequest } from "../../../../_lib/apiHandler";
import { transformFileForDownload, buildSeriesXml, buildMetadataXlsx } from "../../../../_lib/downloadUtils";
import * as XLSX from "xlsx";

export default apiHandler(
  requirePermission("metadata", "read")(async (req: AuthenticatedRequest, res: VercelResponse) => {
    if (req.method !== "GET") {
      return res.status(405).json({ message: "Method not allowed" });
    }

    try {
      const { title, format } = req.query;

      if (!title || typeof title !== "string") {
        return res.status(400).json({ message: "Invalid title" });
      }

      if (!format || typeof format !== "string") {
        return res.status(400).json({ message: "Invalid format" });
      }

      const files = await storage.getMetadataBySeriesTitle(title, req.permissions!);

      if (!files || files.length === 0) {
        return res.status(404).json({ message: "No files found for this series" });
      }

      const transformedFiles = files.map(transformFileForDownload);

      if (format === "xml") {
        const xml = buildSeriesXml(transformedFiles, 'series');

        const filename = title.replace(/[^a-z0-9]/gi, "_").toLowerCase();
        res.setHeader("Content-Type", "application/xml");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="${filename}_series.xml"`,
        );
        res.send(xml);
      } else if (format === "xlsx") {
        const wb = buildMetadataXlsx(files);
        const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

        const filename = title.replace(/[^a-z0-9]/gi, "_").toLowerCase();
        res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="${filename}_series.xlsx"`,
        );
        res.send(buffer);
      } else {
        const filename = title.replace(/[^a-z0-9]/gi, "_").toLowerCase();
        res.setHeader("Content-Type", "application/json");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="${filename}_series.json"`,
        );
        res.json(transformedFiles);
      }
    } catch (error) {
      console.error("Error downloading series:", error);
      res.status(500).json({ message: "Failed to download series" });
    }
  })
);
