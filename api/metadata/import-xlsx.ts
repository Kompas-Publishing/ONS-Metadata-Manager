import type { VercelResponse } from "@vercel/node";
import { storage } from "../_server/storage.js";
import { apiHandler, requirePermission, type AuthenticatedRequest } from "../_lib/apiHandler.js";
import multer from 'multer';
import * as XLSX from 'xlsx';

// Initialize multer for file handling
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Helper to run multer in Vercel environment
const runMiddleware = (req: any, res: any, fn: any) => {
  return new Promise((resolve, reject) => {
    fn(req, res, (result: any) => {
      if (result instanceof Error) {
        return reject(result);
      }
      return resolve(result);
    });
  });
};

export default apiHandler(
  requirePermission("metadata", "write")(async (req: AuthenticatedRequest, res: VercelResponse) => {
    if (req.method !== 'POST') {
      return res.status(405).json({ message: 'Method not allowed' });
    }

    try {
      // Run multer middleware
      await runMiddleware(req, res, upload.array("files"));

      const files = (req as any).files as any[];
      if (!files || files.length === 0) {
        return res.status(400).json({ message: "No files uploaded" });
      }

      const results: any[] = [];
      const errors: string[] = [];

      for (const file of files) {
        try {
          const workbook = XLSX.read(file.buffer, { type: "buffer" });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const data = XLSX.utils.sheet_to_json(worksheet, {
            header: 1,
          }) as any[][];

          if (data.length < 2) continue;

          const headers = data[0];
          const rows = data.slice(1);

          const getIndex = (name: string) =>
            headers.findIndex(
              (h) => h && h.toString().toLowerCase() === name.toLowerCase(),
            );

          const idx = {
            channel: getIndex("Channel"),
            originalFilename: getIndex("Original filename"),
            originalId: getIndex("Original ID"),
            title: getIndex("Title"),
            description: getIndex("Description nl"),
            genre: getIndex("Genre"),
            programRating: getIndex("Program rating"),
            productionCountry: getIndex("Production country"),
            seriesTitle: getIndex("Series title nl"),
            yearOfProduction: getIndex("Year of production"),
            catchUp: getIndex("CatchUp"),
            season: getIndex("Season"),
            episodeCount: getIndex("Number of episodes"),
            episodeTitle: getIndex("Episode title"),
            episode: getIndex("Episode number"),
            episodeDescription: getIndex("Episode description"),
            duration: getIndex("Duration"),
            dateStart: getIndex("Start datetime"),
            dateEnd: getIndex("End datetime"),
            subtitles: getIndex("subtitles"),
            subtitlesId: getIndex("Subtitles ID"),
            segmented: getIndex("Segmented"),
            contentType: getIndex("Content type"),
            tags: getIndex("Tags"),
            audioId: getIndex("Audio ID"),
            category: getIndex("Category"),
            seasonType: getIndex("Season Type"),
            endCredits: getIndex("End Credits"),
            actors: getIndex("Actors"),
          };

          const toIntBool = (val: any) => {
            if (val === undefined || val === null || val === "") return 0;
            const s = val.toString().toLowerCase();
            if (s === "yes" || s === "1" || s === "true") return 1;
            return 0;
          };

          const parseDate = (val: any) => {
            if (!val) return null;
            const d = new Date(val);
            return isNaN(d.getTime()) ? null : d;
          };

          for (const row of rows) {
            try {
              if (!row[idx.title] && !row[idx.seriesTitle]) continue;

              const metadata: any = {
                title:
                  row[idx.title]?.toString() ||
                  row[idx.seriesTitle]?.toString() ||
                  "Untitled",
                channel: row[idx.channel]?.toString() || "ONS",
                originalFilename: row[idx.originalFilename]?.toString(),
                description: row[idx.description]?.toString(),
                genre: row[idx.genre]
                  ? row[idx.genre]
                      .toString()
                      .split("|")
                      .map((s: string) => s.trim())
                  : [],
                programRating: row[idx.programRating]?.toString(),
                productionCountry: row[idx.productionCountry]?.toString(),
                seriesTitle: row[idx.seriesTitle]?.toString(),
                yearOfProduction: row[idx.yearOfProduction]
                  ? parseInt(row[idx.yearOfProduction])
                  : null,
                catchUp: toIntBool(row[idx.catchUp]),
                season: row[idx.season] ? parseInt(row[idx.season]) : null,
                episodeCount: row[idx.episodeCount]
                  ? parseInt(row[idx.episodeCount])
                  : null,
                episodeTitle: row[idx.episodeTitle]?.toString(),
                episode: row[idx.episode] ? parseInt(row[idx.episode]) : null,
                episodeDescription: row[idx.episodeDescription]?.toString(),
                duration: row[idx.duration]?.toString() || "00:00:00",
                dateStart: parseDate(row[idx.dateStart]),
                dateEnd: parseDate(row[idx.dateEnd]),
                subtitles: toIntBool(row[idx.subtitles]),
                subtitlesId: row[idx.subtitlesId]?.toString(),
                segmented: toIntBool(row[idx.segmented]),
                contentType:
                  row[idx.contentType]?.toString() || "Long Form",
                tags: row[idx.tags]
                  ? row[idx.tags]
                      .toString()
                      .split("|")
                      .map((s: string) => s.trim())
                  : [],
                audioId: row[idx.audioId]?.toString(),
                category: row[idx.category]?.toString(),
                seasonType: row[idx.seasonType]?.toString(),
                endCredits: row[idx.endCredits]?.toString(),
                actors: row[idx.actors]
                  ? row[idx.actors]
                      .toString()
                      .split("|")
                      .map((s: string) => s.trim())
                      : [],
              };

              const originalId = row[idx.originalId]?.toString();
              const result = await storage.upsertMetadataFile(
                metadata,
                req.permissions!,
                originalId,
              );
              results.push(result);
            } catch (rowErr: any) {
              errors.push(`Row error in ${file.originalname}: ${rowErr.message}`);
            }
          }
        } catch (fileErr: any) {
          errors.push(`File error ${file.originalname}: ${fileErr.message}`);
        }
      }

      res.json({
        message: `Import completed. ${results.length} records processed.`,
        successCount: results.length,
        errors: errors.length > 0 ? errors : undefined,
      });
    } catch (error: any) {
      console.error("Error importing XLSX:", error);
      res.status(500).json({ message: "Failed to import XLSX: " + error.message });
    }
  })
);
