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

          const headers = data[0].map(h => h?.toString().toLowerCase().trim());
          const rows = data.slice(1);

          const getIndex = (names: string[]) => {
            for (const name of names) {
              const idx = headers.findIndex((h) => h === name.toLowerCase() || (h && h.includes(`(${name.toLowerCase()})`)));
              if (idx !== -1) return idx;
              
              // Try exact match or match containing the string (for old format headers like "Title (Clipnaam)")
              const fuzzyIdx = headers.findIndex(h => h && (h === name.toLowerCase() || h.includes(name.toLowerCase())));
              if (fuzzyIdx !== -1) return fuzzyIdx;
            }
            return -1;
          };

          const idx = {
            channel: getIndex(["Channel", "Zender"]),
            originalFilename: getIndex(["Original filename", "original_filename"]),
            originalId: getIndex(["Original ID", "orginal_ID", "original_id"]),
            title: getIndex(["Title", "Title (Clipnaam)"]),
            description: getIndex(["Description nl", "description_nl", "description_nl (Omschrijving)"]),
            genre: getIndex(["Genre", "Program Genre"]),
            programRating: getIndex(["Program rating", "Program Rating"]),
            productionCountry: getIndex(["Production country", "production_country"]),
            seriesTitle: getIndex(["Series title nl", "series_titel_nl", "Serie"]),
            yearOfProduction: getIndex(["Year of production", "year_of_production"]),
            catchUp: getIndex(["CatchUp"]),
            season: getIndex(["Season"]),
            episodeCount: getIndex(["Number of episodes", "Episode/scene total"]),
            episodeTitle: getIndex(["Episode title", "EpisodeTitle"]),
            episode: getIndex(["Episode number", "Episode_num"]),
            episodeDescription: getIndex(["Episode description", "episode_description"]),
            duration: getIndex(["Duration", "duration"]),
            dateStart: getIndex(["Start datetime", "date_start"]),
            dateEnd: getIndex(["End datetime", "date_end"]),
            subtitles: getIndex(["subtitles", "Subtitles"]),
            subtitlesId: getIndex(["Subtitles ID", "Subtitles ID"]),
            segmented: getIndex(["Segmented", "segmented"]),
            contentType: getIndex(["Content type", "Content Type"]),
            tags: getIndex(["Tags"]),
            audioId: getIndex(["Audio ID"]),
            category: getIndex(["Category"]),
            seasonType: getIndex(["Season Type"]),
            endCredits: getIndex(["End Credits"]),
            actors: getIndex(["Actors"]),
            breakTimes: getIndex(["break_times", "Breaktijden"]),
          };

          const toIntBool = (val: any) => {
            if (val === undefined || val === null || val === "") return 0;
            const s = val.toString().toLowerCase().trim();
            if (s === "yes" || s === "1" || s === "true" || s === "y") return 1;
            return 0;
          };

          const parseDate = (val: any) => {
            if (!val) return null;
            // Handle Excel numeric dates
            if (typeof val === 'number') {
               return new Date(Math.round((val - 25569) * 86400 * 1000));
            }
            const d = new Date(val);
            return isNaN(d.getTime()) ? null : d;
          };

          const formatDuration = (val: any) => {
            if (!val) return "00:00:00";
            if (typeof val === 'number') {
              // Excel time is fraction of a day
              const totalSeconds = Math.round(val * 86400);
              const h = Math.floor(totalSeconds / 3600);
              const m = Math.floor((totalSeconds % 3600) / 60);
              const s = totalSeconds % 60;
              return [h, m, s].map(v => v.toString().padStart(2, '0')).join(':');
            }
            return val.toString();
          };

          for (const row of rows) {
            try {
              if (!row || row.length === 0) continue;
              
              // Skip instruction rows
              const firstCell = row[0]?.toString() || "";
              if (firstCell.includes("Te vinden in") || firstCell.includes("Uitleg")) continue;
              
              const titleValue = row[idx.title]?.toString() || row[idx.seriesTitle]?.toString();
              if (!titleValue || titleValue.includes("Te vinden in")) continue;

              const metadata: any = {
                title: titleValue,
                channel: row[idx.channel]?.toString() || "ONS",
                originalFilename: row[idx.originalFilename]?.toString(),
                description: row[idx.description]?.toString(),
                genre: row[idx.genre]
                  ? row[idx.genre]
                      .toString()
                      .split("|")
                      .map((s: string) => s.trim())
                      .filter(Boolean)
                  : [],
                programRating: row[idx.programRating]?.toString(),
                productionCountry: row[idx.productionCountry]?.toString(),
                seriesTitle: row[idx.seriesTitle]?.toString() || titleValue,
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
                duration: formatDuration(row[idx.duration]),
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
                      .filter(Boolean)
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
                      .filter(Boolean)
                  : [],
              };

              // Handle breakTimes (supporting multiple columns if named the same or similar)
              const breakTimes: string[] = [];
              if (idx.breakTimes !== -1) {
                // Check multiple columns for Breaktijden
                headers.forEach((h, i) => {
                  if (h && h.includes("breaktijden")) {
                    const bt = formatDuration(row[i]);
                    if (bt && bt !== "00:00:00") breakTimes.push(bt);
                  }
                });
              }
              metadata.breakTimes = breakTimes;
              if (breakTimes.length > 0) metadata.breakTime = breakTimes[0];

              const originalId = row[idx.originalId]?.toString();
              const result = await storage.upsertMetadataFile(
                metadata,
                req.userPermissions!,
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
