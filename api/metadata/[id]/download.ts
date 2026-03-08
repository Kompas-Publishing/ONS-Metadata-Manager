import type { VercelRequest, VercelResponse } from "@vercel/node";
import { storage } from "../../../_server/storage.js";
import { apiHandler, requirePermission, type AuthenticatedRequest } from "../../../_lib/apiHandler.js";
import { transformFileForDownload, buildMetadataXml, buildMetadataXlsx } from "../../../_lib/downloadUtils.js";
import * as XLSX from "xlsx";

export default apiHandler(
  requirePermission("metadata", "read")(async (req: AuthenticatedRequest, res: VercelResponse) => {
    if (req.method !== "GET") {
      return res.status(405).json({ message: "Method not allowed" });
    }

    try {
      const { id } = req.query;

      if (!id || typeof id !== "string") {
        return res.status(400).json({ message: "Invalid ID" });
      }

      const file = await storage.getMetadataFile(id, req.userPermissions!);
      if (!file) {
        return res.status(404).json({ message: "File not found" });
      }

      const transformedFile = transformFileForDownload(file);
      const format = (req.query.format as string) || "json";

      if (format === "xml") {
        console.log("[XML Download] Building XML for file:", id);
        const xml = buildMetadataXml(transformedFile);
        console.log("[XML Download] XML built, length:", xml.length);

        res.setHeader("Content-Type", "application/xml; charset=utf-8");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="${transformedFile.id}.xml"`,
        );
        return res.send(xml);
      } else if (format === "xlsx") {
        const wb = buildMetadataXlsx([file]);
        const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

        res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="${file.id}.xlsx"`,
        );
        res.send(buffer);
      } else {
        res.setHeader("Content-Type", "application/json");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="${transformedFile.id}.json"`,
        );
        res.json(transformedFile);
      }
    } catch (error) {
      console.error("Error downloading file:", error);
      res.status(500).json({ message: "Failed to download file" });
    }
  })
);
