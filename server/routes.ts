import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./authSetup";
import passport from "passport";
import bcrypt from "bcryptjs";
import {
  insertMetadataFileSchema,
  batchCreateSchema,
  insertUserDefinedTagSchema,
  insertLicenseSchema,
  licenseBatchGenerateSchema,
  insertTaskSchema,
  type InsertMetadataFile,
} from "@shared/schema";
import { create } from "xmlbuilder2";
import { z } from "zod";
import { getUserPermissions, requirePermission } from "./permissions";
import * as XLSX from "xlsx";
import { rateLimit } from "express-rate-limit";
import multer from "multer";
import { aiService } from "./ai-service";

const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 login requests per window
  message: { message: "Too many login attempts, please try again after 15 minutes" },
  standardHeaders: true,
  legacyHeaders: false,
});

function transformFileForDownload(file: any): any {
  // Convert booleans to True/False strings
  const boolToString = (val: any) => {
    if (val === null || val === undefined) return null;
    return val === 1 || val === true ? "True" : "False";
  };

  return {
    // Identification
    id: file.id,
    channel: file.channel ?? null,
    category: file.category ?? null,
    contentType: file.contentType ?? null,
    seasonType: file.seasonType ?? null,
    productionCountry: file.productionCountry ?? null,
    yearOfProduction: file.yearOfProduction ?? null,
    programRating: file.programRating ?? null,

    // Titles
    title: file.title ?? null,
    seriesTitle: file.seriesTitle ?? null,
    episodeTitle: file.episodeTitle ?? null,

    // Description
    description: file.description ?? null,
    episodeDescription: file.episodeDescription ?? null,

    // Season/Episode
    season: file.season ?? null,
    episode: file.episode ?? null,

    // Time / Runtime
    duration: file.duration ?? null,
    // Prefer a dedicated breakTime field, otherwise first element of breakTimes array
    breakTime:
      file.breakTime ??
      (Array.isArray(file.breakTimes) && file.breakTimes.length > 0
        ? file.breakTimes[0]
        : null),
    breakTimes: Array.isArray(file.breakTimes) ? file.breakTimes : [],
    endCredits: file.endCredits ?? null,
    // Full ISO timestamps, including time and Z
    dateStart: file.dateStart ? file.dateStart.toISOString() : null,
    dateEnd: file.dateEnd ? file.dateEnd.toISOString() : null,

    // People
    actors: file.actors || [],

    // Genre
    genre: file.genre || [],
    
    // Tags
    tags: file.tags || [],

    // Technical flags
    audioId: file.audioId ?? null,
    originalFilename: file.originalFilename ?? null,
    catchUp: boolToString(file.catchUp),
    segmented: boolToString(file.segmented),
    subtitles: boolToString(file.subtitles),
    subtitlesId: file.subtitlesId ?? null,

    // Timestamps
    createdAt: file.createdAt ? file.createdAt.toISOString() : null,
  };
}

// Helper to build a single item element with comments using fluent API
function buildItemXml(file: any, itemElement: any) {
  const actors = Array.isArray(file.actors) ? file.actors : [];
  const genre = Array.isArray(file.genre) ? file.genre : [];
  const tags = Array.isArray(file.tags) ? file.tags : [];
  const breakTimes = Array.isArray(file.breakTimes) ? file.breakTimes : [];
  
  // Identification section
  itemElement.com(' Identification ');
  itemElement.ele('id').txt(file.id || '').up();
  itemElement.ele('channel').txt(file.channel || '').up();
  itemElement.ele('category').txt(file.category || '').up();
  itemElement.ele('contentType').txt(file.contentType || '').up();
  itemElement.ele('seasonType').txt(file.seasonType || '').up();
  itemElement.ele('productionCountry').txt(file.productionCountry || '').up();
  itemElement.ele('yearOfProduction').txt(file.yearOfProduction || '').up();
  itemElement.ele('programRating').txt(file.programRating || '').up();
  
  // Titles section
  itemElement.com(' Titles ');
  itemElement.ele('title').txt(file.title || '').up();
  itemElement.ele('seriesTitle').txt(file.seriesTitle || '').up();
  itemElement.ele('episodeTitle').txt(file.episodeTitle || '').up();
  
  // Description section
  itemElement.com(' Description ');
  itemElement.ele('description').txt(file.description || '').up();
  itemElement.ele('episodeDescription').txt(file.episodeDescription || '').up();
  
  // Season/Episode section
  itemElement.com(' Season/Episode ');
  itemElement.ele('season').txt(file.season || '').up();
  itemElement.ele('episode').txt(file.episode || '').up();
  
  // Time/Runtime section
  itemElement.com(' Time/Runtime ');
  itemElement.ele('duration').txt(file.duration || '').up();
  itemElement.ele('breakTime').txt(file.breakTime || '').up();
  
  // Add breakTimes array if present
  if (breakTimes.length > 0) {
    const breakTimesEle = itemElement.ele('breakTimes');
    breakTimes.forEach((time: string) => {
      breakTimesEle.ele('breakTime').txt(time).up();
    });
    breakTimesEle.up();
  }
  
  itemElement.ele('endCredits').txt(file.endCredits || '').up();
  itemElement.ele('dateStart').txt(file.dateStart || '').up();
  itemElement.ele('dateEnd').txt(file.dateEnd || '').up();
  
  // People section
  itemElement.com(' People ');
  if (actors.length > 0) {
    const actorsEle = itemElement.ele('actors');
    actors.forEach((actor: string) => {
      actorsEle.ele('actor').txt(actor).up();
    });
    actorsEle.up();
  }
  
  // Genre section
  itemElement.com(' Genre ');
  if (genre.length > 0) {
    const genreEle = itemElement.ele('genre');
    genre.forEach((g: string) => {
      genreEle.ele('item').txt(g).up();
    });
    genreEle.up();
  }
  
  // Tags section
  itemElement.com(' Tags ');
  if (tags.length > 0) {
    const tagsEle = itemElement.ele('tags');
    tags.forEach((tag: string) => {
      tagsEle.ele('tag').txt(tag).up();
    });
    tagsEle.up();
  }
  
  // Technical section
  itemElement.com(' Technical ');
  itemElement.ele('audioId').txt(file.audioId || '').up();
  itemElement.ele('originalFilename').txt(file.originalFilename || '').up();
  itemElement.ele('catchUp').txt(file.catchUp || '').up();
  itemElement.ele('segmented').txt(file.segmented || '').up();
  itemElement.ele('subtitles').txt(file.subtitles || '').up();
  itemElement.ele('subtitlesId').txt(file.subtitlesId || '').up();
  
  // Timestamps section
  itemElement.com(' Timestamps ');
  itemElement.ele('createdAt').txt(file.createdAt || '').up();
}

// Build XML for a single file
function buildMetadataXml(file: any): string {
  const doc = create({ version: '1.0' });
  const metadata = doc.ele('metadata');
  const item = metadata.ele('item');
  buildItemXml(file, item);
  // Serialize from document root
  return doc.end({ prettyPrint: true });
}

// Transform raw file data to XLSX row format matching the required template
function transformFileToXlsxRow(file: any, maxBreakTimes: number = 0): any[] {
  const breakTimes = Array.isArray(file.breakTimes) ? file.breakTimes : [];
  const genre = Array.isArray(file.genre) ? file.genre.join(" | ") : (file.genre || "");
  const tags = Array.isArray(file.tags) ? file.tags.join(" | ") : (file.tags || "");
  const actors = Array.isArray(file.actors) ? file.actors.join(" | ") : (file.actors || "");
  
  // Convert boolean/numeric flags to yes/no strings (template requires lowercase)
  const toYesNo = (val: any) => {
    if (val === null || val === undefined) return "";
    if (val === 1 || val === true || val === "True") return "yes";
    if (val === 0 || val === false || val === "False") return "no";
    return val;
  };
  
  // Format dates to YYYY-MM-DD
  const formatDate = (date: any) => {
    if (!date) return "";
    const d = new Date(date);
    if (isNaN(d.getTime())) return "";
    return d.toISOString().split('T')[0];
  };
  
  // Build row matching the exact template structure
  // Columns 1-25: Required template fields
  // Column 26+: Timecodes (padded to maxBreakTimes for alignment)
  // After timecodes: Our custom fields
  // Padding to 104: Empty columns to match template width
  const row = [
    file.channel || "",                           // Column 1: Channel
    file.originalFilename || "",                  // Column 2: Original filename
    "",                                           // Column 3: Original thumb filename (not in schema)
    file.id || "",                                // Column 4: Original ID (use our file ID)
    file.title || "",                             // Column 5: Title
    file.description || "",                       // Column 6: Description nl
    genre,                                        // Column 7: Genre
    file.programRating || "",                     // Column 8: Program rating
    file.productionCountry || "",                 // Column 9: Production country
    file.season ? "yes" : "no",                   // Column 10: Serie (yes if has season)
    file.seriesTitle || "",                       // Column 11: Series title nl
    file.yearOfProduction || "",                  // Column 12: Year of production
    toYesNo(file.catchUp),                        // Column 13: CatchUp (yes/no)
    file.season || "",                            // Column 14: Season
    file.episodeCount || "",                      // Column 15: Number of episodes
    file.episodeTitle || "",                      // Column 16: Episode title
    file.episode || "",                           // Column 17: Episode number
    file.episodeDescription || "",                // Column 18: Episode description
    file.duration || "",                          // Column 19: Duration
    formatDate(file.dateStart),                   // Column 20: Start datetime
    formatDate(file.dateEnd),                     // Column 21: End datetime
    toYesNo(file.subtitles),                      // Column 22: subtitles (yes/no)
    file.subtitlesId || "",                       // Column 23: Subtitles ID
    toYesNo(file.segmented),                      // Column 24: Segmented (yes/no)
    file.contentType || "",                       // Column 25: Content type
  ];
  
  // Column 26+: Add timecodes and pad to maxBreakTimes for consistent column alignment
  for (let i = 0; i < maxBreakTimes; i++) {
    row.push(breakTimes[i] || "");
  }
  
  // Add our custom fields after the reserved timecode columns
  row.push(tags);                                 // Tags
  row.push(file.audioId || "");                   // Audio ID
  row.push(file.category || "");                  // Category
  row.push(file.seasonType || "");                // Season Type
  row.push(file.endCredits || "");                // End Credits
  row.push(actors);                               // Actors
  
  // Calculate how many columns we need to pad to reach column 104 (template width)
  // Current row length is 25 (template fields) + maxBreakTimes + 6 (custom fields)
  const TEMPLATE_TOTAL_COLUMNS = 104;
  const currentLength = row.length;
  
  // Pad with empty columns to reach exactly 104 columns total
  for (let i = currentLength; i < TEMPLATE_TOTAL_COLUMNS; i++) {
    row.push("");
  }
  
  return row;
}

// Build XLSX workbook from array of files
function buildMetadataXlsx(files: any[]): XLSX.WorkBook {
  // Find the maximum number of break times across all files
  const maxBreakTimes = files.reduce((max, file) => {
    const breakTimesCount = Array.isArray(file.breakTimes) ? file.breakTimes.length : 0;
    return Math.max(max, breakTimesCount);
  }, 0);
  
  // Define column headers matching the template structure
  // Columns 1-25: Required template fields (from user's template)
  // Column 26+: Timecodes (dynamic, based on maxBreakTimes)
  // After timecodes: Our custom fields (Tags, Audio ID, etc.)
  // Padding to 104: Empty columns to match template width
  const headers = [
    // Columns 1-25: Required template fields
    "Channel",                    // 1
    "Original filename",          // 2
    "Original thumb filename",    // 3
    "Original ID",                // 4
    "Title",                      // 5
    "Description nl",             // 6
    "Genre",                      // 7
    "Program rating",             // 8
    "Production country",         // 9
    "Serie",                      // 10
    "Series title nl",            // 11
    "Year of production",         // 12
    "CatchUp",                    // 13
    "Season",                     // 14
    "Number of episodes",         // 15
    "Episode title",              // 16
    "Episode number",             // 17
    "Episode description",        // 18
    "Duration",                   // 19
    "Start datetime",             // 20
    "End datetime",               // 21
    "subtitles",                  // 22
    "Subtitles ID",               // 23
    "Segmented",                  // 24
    "Content type",               // 25
  ];
  
  // Add timecode headers (first one labeled, rest empty for alignment)
  for (let i = 0; i < maxBreakTimes; i++) {
    headers.push(i === 0 ? "Timecodes" : "");
  }
  
  // Add our custom fields after timecode columns
  headers.push("Tags");
  headers.push("Audio ID");
  headers.push("Category");
  headers.push("Season Type");
  headers.push("End Credits");
  headers.push("Actors");
  
  // Pad to 104 columns total
  const TEMPLATE_TOTAL_COLUMNS = 104;
  while (headers.length < TEMPLATE_TOTAL_COLUMNS) {
    headers.push("");
  }
  
  // Convert files to rows, passing maxBreakTimes for consistent column alignment
  const rows = files.map(file => transformFileToXlsxRow(file, maxBreakTimes));
  
  // Combine headers and data
  const data = [headers, ...rows];
  
  // Create worksheet
  const ws = XLSX.utils.aoa_to_sheet(data);
  
  // Create workbook
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Worksheet");
  
  return wb;
}

const isAdminUser = async (req: any, res: any, next: any) => {
  try {
    if (!req.isAuthenticated() || !req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const user = req.user as any;

    if (!user || user.isAdmin !== 1) {
      return res
        .status(403)
        .json({ message: "Forbidden: Admin access required" });
    }

    if (user.status !== "active") {
      return res.status(403).json({ message: "Admin account is not active" });
    }

    next();
  } catch (error) {
    console.error("Error in admin middleware:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export async function registerRoutes(app: Express): Promise<Server> {
  await setupAuth(app);

  app.post("/api/auth/register", async (req, res) => {
    try {
      const { email, password, firstName, lastName } = req.body;

      if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required" });
      }

      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ message: "Email already registered" });
      }

      const hashedPassword = await bcrypt.hash(password, 12);

      const user = await storage.createUser({
        email,
        password: hashedPassword,
        firstName: firstName || null,
        lastName: lastName || null,
        authProvider: "local",
        status: "pending",
        canRead: 0,
        canWrite: 0,
        canEdit: 0,
        fileVisibility: "own",
        isAdmin: 0,
      });

      res.json({ 
        message: "Registration successful. Please wait for admin approval.",
        user: { id: user.id, email: user.email, status: user.status }
      });
    } catch (error: any) {
      console.error("Registration error:", error);
      res.status(500).json({ message: "Registration failed" });
    }
  });

  app.post("/api/auth/login", loginLimiter, (req, res, next) => {
    // Pentest Fix: Strict type validation to prevent NoSQL/Object injection
    const { email, password } = req.body;
    if (typeof email !== 'string' || typeof password !== 'string') {
      return res.status(400).json({ message: "Invalid input types. Email and password must be strings." });
    }

    passport.authenticate("local", (err: any, user: any, info: any) => {
      if (err) {
        return res.status(500).json({ message: "Authentication failed" });
      }
      if (!user) {
        return res.status(401).json({ message: "Authentication failed" });
      }
      
      req.logIn(user, (loginErr) => {
        if (loginErr) {
          console.error("Session save error:", loginErr);
          return res.status(500).json({ message: "Failed to establish session" });
        }
        const { password, ...userWithoutPassword } = user;
        res.json({ user: userWithoutPassword });
      });
    })(req, res, next);
  });

  app.get("/api/auth/google", passport.authenticate("google", { scope: ["profile", "email"] }));

  app.get("/api/auth/google/callback",
    passport.authenticate("google", { failureRedirect: "/login?error=auth_failed" }),
    (req, res) => {
      const user = req.user as any;
      if (user && user.status === "pending") {
        res.redirect("/pending");
      } else {
        res.redirect("/");
      }
    }
  );

  app.post("/api/auth/logout", (req, res) => {
    req.logout((err) => {
      if (err) {
        return res.status(500).json({ message: "Logout failed" });
      }
      res.json({ message: "Logged out successfully" });
    });
  });

  app.get("/api/auth/user", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      const { password, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  app.get("/api/metadata/next-id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any)?.id;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { allowed, permissions, reason } = await requirePermission(
        userId,
        "write",
      );

      if (!allowed) {
        const statusCode = permissions?.user.status === "pending" ? 423 : 403;
        return res.status(statusCode).json({ message: reason });
      }

      const nextId = await storage.peekNextId();
      res.json(nextId);
    } catch (error) {
      console.error("Error getting next ID:", error);
      res.status(500).json({ message: "Failed to get next ID" });
    }
  });

  app.get("/api/metadata", isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any)?.id;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { allowed, permissions, reason } = await requirePermission(
        userId,
        "read",
      );

      if (!allowed) {
        const statusCode = permissions?.user.status === "pending" ? 423 : 403;
        return res.status(statusCode).json({ message: reason });
      }

      const { licenseId } = req.query;
      const files = await storage.getAllMetadataFiles(
        permissions!,
        typeof licenseId === "string" ? licenseId : undefined
      );
      res.json(files);
    } catch (error) {
      console.error("Error fetching metadata files:", error);
      res.status(500).json({ message: "Failed to fetch metadata files" });
    }
  });

  app.get("/api/metadata/recent", isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any)?.id;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { allowed, permissions, reason } = await requirePermission(
        userId,
        "read",
      );

      if (!allowed) {
        const statusCode = permissions?.user.status === "pending" ? 423 : 403;
        return res.status(statusCode).json({ message: reason });
      }

      const files = await storage.getRecentMetadataFiles(10, permissions!);
      res.json(files);
    } catch (error) {
      console.error("Error fetching recent files:", error);
      res.status(500).json({ message: "Failed to fetch recent files" });
    }
  });

  app.get(
    "/api/metadata/season/:title/:season",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const userId = (req.user as any)?.id;
        if (!userId) {
          return res.status(401).json({ message: "Unauthorized" });
        }

        const { allowed, permissions, reason } = await requirePermission(
          userId,
          "read",
        );

        if (!allowed) {
          const statusCode = permissions?.user.status === "pending" ? 423 : 403;
          return res.status(statusCode).json({ message: reason });
        }

        const { title, season } = req.params;
        const seasonNum = parseInt(season);

        if (isNaN(seasonNum)) {
          return res.status(400).json({ message: "Invalid season number" });
        }

        const decodedTitle = decodeURIComponent(title);
        const files = await storage.getMetadataBySeason(
          decodedTitle,
          seasonNum,
          permissions!,
        );

        res.json(files);
      } catch (error) {
        console.error("Error fetching season metadata:", error);
        res.status(500).json({ message: "Failed to fetch season metadata" });
      }
    },
  );

  app.get("/api/metadata/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any)?.id;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { allowed, permissions, reason } = await requirePermission(
        userId,
        "read",
      );

      if (!allowed) {
        const statusCode = permissions?.user.status === "pending" ? 423 : 403;
        return res.status(statusCode).json({ message: reason });
      }

      const file = await storage.getMetadataFile(req.params.id, permissions!);
      if (!file) {
        return res.status(404).json({ message: "File not found" });
      }
      res.json(file);
    } catch (error) {
      console.error("Error fetching metadata file:", error);
      res.status(500).json({ message: "Failed to fetch metadata file" });
    }
  });

  app.post("/api/metadata", isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any)?.id;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { allowed, permissions, reason } = await requirePermission(
        userId,
        "write",
      );

      if (!allowed) {
        const statusCode = permissions?.user.status === "pending" ? 423 : 403;
        return res.status(statusCode).json({ message: reason });
      }

      const validation = insertMetadataFileSchema.safeParse(req.body);

      if (!validation.success) {
        return res.status(400).json({
          message: "Validation failed",
          errors: validation.error.errors,
        });
      }

      const fileData = {
        ...validation.data,
        groupId:
          permissions!.fileVisibility === "group" && permissions!.groupIds.length > 0
            ? permissions!.groupIds[0]
            : null,
      };

      const nextId = await storage.consumeNextId();
      const file = await storage.createMetadataFile(
        fileData,
        nextId,
        permissions!,
      );

      res.json(file);
    } catch (error) {
      console.error("Error creating metadata file:", error);
      res.status(500).json({ message: "Failed to create metadata file" });
    }
  });

  // IMPORTANT: Define bulk-update route BEFORE /:id route to prevent route matching conflict
  app.patch(
    "/api/metadata/bulk-update",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const userId = (req.user as any)?.id;
        if (!userId) {
          return res.status(401).json({ message: "Unauthorized" });
        }

        const { allowed, permissions, reason } = await requirePermission(
          userId,
          "edit",
        );

        if (!allowed) {
          const statusCode = permissions?.user.status === "pending" ? 423 : 403;
          return res.status(statusCode).json({ message: reason });
        }

        // Define bulk update schema with only editable fields
        // Use nullable().optional() to handle both null, undefined, and missing fields
        const bulkUpdateSchema = z.object({
          updates: z.array(
            z.object({
              id: z.string(),
              data: z.object({
                channel: z.string().nullable().optional(),
                seasonType: z.enum(["Winter", "Summer", "Autumn", "Spring", ""]).transform(val => val === "" ? undefined : val).nullable().optional(),
                contentType: z.string().nullable().optional(),
                genre: z.array(z.string()).nullable().optional(),
                programRating: z.enum(["AL", "6", "9", "12", "16", "18", ""]).transform(val => val === "" ? undefined : val).nullable().optional(),
                productionCountry: z.string().nullable().optional(),
                yearOfProduction: z.number().int().positive().max(new Date().getFullYear()).nullable().optional(),
                catchUp: z.union([z.number().int().min(0).max(1), z.boolean()]).nullable().optional(),
                subtitles: z.union([z.number().int().min(0).max(1), z.boolean()]).nullable().optional(),
                segmented: z.union([z.number().int().min(0).max(1), z.boolean()]).nullable().optional(),
              }).passthrough(), // Allow additional fields but only use whitelisted ones
            }),
          ),
        });

        const validation = bulkUpdateSchema.safeParse(req.body);

        if (!validation.success) {
          return res.status(400).json({
            message: "Validation failed",
            errors: validation.error.errors,
          });
        }

        const ids = validation.data.updates.map((u) => u.id);
        const existingFiles = await storage.getMetadataByIds(ids, permissions!);

        if (existingFiles.length !== ids.length) {
          return res.status(404).json({
            message: "Some files not found or unauthorized",
          });
        }

        const BULK_EDITABLE_FIELDS = [
          "channel",
          "seasonType",
          "contentType",
          "genre",
          "programRating",
          "productionCountry",
          "yearOfProduction",
          "catchUp",
          "subtitles",
          "segmented",
          "licenseId",
        ];

        const sanitized = validation.data.updates.map((u) => {
          const filteredData: any = Object.fromEntries(
            Object.entries(u.data).filter(([key]) =>
              BULK_EDITABLE_FIELDS.includes(key),
            ),
          );

          const dataUpdate: Partial<InsertMetadataFile> = {
            ...filteredData,
            catchUp:
              typeof filteredData.catchUp === "boolean"
                ? filteredData.catchUp
                  ? 1
                  : 0
                : filteredData.catchUp,
            segmented:
              typeof filteredData.segmented === "boolean"
                ? filteredData.segmented
                  ? 1
                  : 0
                : filteredData.segmented,
            subtitles:
              typeof filteredData.subtitles === "boolean"
                ? filteredData.subtitles
                  ? 1
                  : 0
                : filteredData.subtitles,
          };

          return {
            id: u.id,
            data: dataUpdate,
          };
        });

        const count = await storage.bulkUpdateMetadata(sanitized, permissions!);
        res.json({ message: "Bulk update successful", count });
      } catch (error) {
        console.error("Error bulk updating metadata:", error);
        res.status(500).json({ message: "Failed to bulk update metadata" });
      }
    },
  );

  app.patch("/api/metadata/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any)?.id;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { allowed, permissions, reason } = await requirePermission(
        userId,
        "edit",
      );

      if (!allowed) {
        const statusCode = permissions?.user.status === "pending" ? 423 : 403;
        return res.status(statusCode).json({ message: reason });
      }

      const validation = insertMetadataFileSchema.safeParse(req.body);

      if (!validation.success) {
        return res.status(400).json({
          message: "Validation failed",
          errors: validation.error.errors,
        });
      }

      const fileData = {
        ...validation.data,
        groupId: permissions!.isAdmin
          ? validation.data.groupId
          : permissions!.fileVisibility === "group" && permissions!.groupIds.length > 0
            ? permissions!.groupIds[0]
            : null,
      };

      const file = await storage.updateMetadataFile(
        req.params.id,
        fileData,
        permissions!,
      );
      if (!file) {
        return res.status(404).json({ message: "File not found" });
      }
      res.json(file);
    } catch (error) {
      console.error("Error updating metadata file:", error);
      res.status(500).json({ message: "Failed to update metadata file" });
    }
  });

  app.delete("/api/metadata/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any)?.id;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { allowed, permissions, reason } = await requirePermission(
        userId,
        "delete",
      );

      if (!allowed) {
        const statusCode = permissions?.user.status === "pending" ? 423 : 403;
        return res.status(statusCode).json({ message: reason });
      }

      const success = await storage.deleteMetadataFile(
        req.params.id,
        permissions!,
      );
      if (!success) {
        return res.status(404).json({ message: "File not found" });
      }
      res.json({ message: "File deleted successfully" });
    } catch (error) {
      console.error("Error deleting metadata file:", error);
      res.status(500).json({ message: "Failed to delete metadata file" });
    }
  });

  app.post("/api/metadata/batch", isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any)?.id;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { allowed, permissions, reason } = await requirePermission(
        userId,
        "write",
      );

      if (!allowed) {
        const statusCode = permissions?.user.status === "pending" ? 423 : 403;
        return res.status(statusCode).json({ message: reason });
      }

      const validation = batchCreateSchema.safeParse(req.body);

      if (!validation.success) {
        return res.status(400).json({
          message: "Validation failed",
          errors: validation.error.errors,
        });
      }

      const files = await storage.createBatchMetadataFiles(
        validation.data,
        permissions!,
      );

      res.json({
        message: "Batch created successfully",
        count: files.length,
        files,
      });
    } catch (error) {
      console.error("Error creating batch:", error);
      res.status(500).json({ message: "Failed to create batch" });
    }
  });

  app.post("/api/metadata/multi-batch", isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any)?.id;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { allowed, permissions, reason } = await requirePermission(
        userId,
        "write",
      );

      if (!allowed) {
        const statusCode = permissions?.user.status === "pending" ? 423 : 403;
        return res.status(statusCode).json({ message: reason });
      }

      const multiBatchCreateSchema = z.object({
        batches: z.array(z.any()), // We'll let storage handle detailed validation or use the schema from shared
        taskDescription: z.string().optional(),
      });

      const validation = multiBatchCreateSchema.safeParse(req.body);

      if (!validation.success) {
        return res.status(400).json({
          message: "Validation failed",
          errors: validation.error.errors,
        });
      }

      const files = await storage.createMultiBatchMetadataFiles(
        validation.data,
        permissions!,
      );

      res.json({
        message: "Multi-batch created successfully",
        count: files.length,
        files,
      });
    } catch (error) {
      console.error("Error creating multi-batch:", error);
      res.status(500).json({ message: "Failed to create multi-batch" });
    }
  });

  app.patch("/api/licenses/link-metadata", isAuthenticated, async (req: any, res: any) => {
    try {
      const userId = (req.user as any)?.id;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { allowed, permissions, reason } = await requirePermission(
        userId,
        "edit",
      );

      if (!allowed) {
        const statusCode = permissions?.user.status === "pending" ? 423 : 403;
        return res.status(statusCode).json({ message: reason });
      }

      const linkMetadataSchema = z.object({
        licenseId: z.string().nullable(),
        metadataIds: z.array(z.string()),
      });

      const validation = linkMetadataSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          message: "Validation failed",
          errors: validation.error.errors,
        });
      }

      const { licenseId, metadataIds } = validation.data;

      // Update all selected metadata files to point to this license
      await storage.bulkUpdateMetadata(
        metadataIds.map(id => ({ id, data: { licenseId } })),
        permissions!
      );

      res.json({ message: "Metadata linked to license successfully" });
    } catch (error) {
      console.error("Error linking metadata to license:", error);
      res.status(500).json({ message: "Failed to link metadata" });
    }
  });

  app.get(
    "/api/metadata/download/series/:title/:format",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const userId = (req.user as any)?.id;
        if (!userId) {
          return res.status(401).json({ message: "Unauthorized" });
        }

        const { allowed, permissions, reason } = await requirePermission(
          userId,
          "read",
        );

        if (!allowed) {
          const statusCode = permissions?.user.status === "pending" ? 423 : 403;
          return res.status(statusCode).json({ message: reason });
        }

        const { title, format } = req.params;
        const files = await storage.getMetadataBySeriesTitle(
          title,
          permissions!,
        );

        if (!files || files.length === 0) {
          return res
            .status(404)
            .json({ message: "No files found for this series" });
        }

        const transformedFiles = files.map(transformFileForDownload);

        if (format === "xml") {
          // Build XML with multiple items using fluent API
          const root = create({ version: '1.0' }).ele('series');
          transformedFiles.forEach(file => {
            const item = root.ele('item');
            buildItemXml(file, item);
            item.up();
          });
          const xml = root.end({ prettyPrint: true });

          const filename = title.replace(/[^a-z0-9]/gi, "_").toLowerCase();
          res.setHeader("Content-Type", "application/xml");
          res.setHeader(
            "Content-Disposition",
            `attachment; filename="${filename}_series.xml"`,
          );
          res.send(xml);
        } else if (format === "xlsx") {
          // Use raw files for XLSX to avoid boolean normalization issues
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
    },
  );

  app.get(
    "/api/metadata/download/series/:title",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const userId = (req.user as any)?.id;
        if (!userId) {
          return res.status(401).json({ message: "Unauthorized" });
        }

        const { allowed, permissions, reason } = await requirePermission(
          userId,
          "read",
        );

        if (!allowed) {
          const statusCode = permissions?.user.status === "pending" ? 423 : 403;
          return res.status(statusCode).json({ message: reason });
        }

        const { title } = req.params;
        const files = await storage.getMetadataBySeriesTitle(
          title,
          permissions!,
        );

        if (!files || files.length === 0) {
          return res
            .status(404)
            .json({ message: "No files found for this series" });
        }

        const transformedFiles = files.map(transformFileForDownload);
        const filename = title.replace(/[^a-z0-9]/gi, "_").toLowerCase();
        res.setHeader("Content-Type", "application/json");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="${filename}_series.json"`,
        );
        res.json({ files: transformedFiles, count: transformedFiles.length });
      } catch (error) {
        console.error("Error downloading series:", error);
        res.status(500).json({ message: "Failed to download series" });
      }
    },
  );

  app.get(
    "/api/metadata/download/season/:title/:season/:format",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const userId = (req.user as any)?.id;
        if (!userId) {
          return res.status(401).json({ message: "Unauthorized" });
        }

        const { allowed, permissions, reason } = await requirePermission(
          userId,
          "read",
        );

        if (!allowed) {
          const statusCode = permissions?.user.status === "pending" ? 423 : 403;
          return res.status(statusCode).json({ message: reason });
        }

        const { title, season, format } = req.params;
        const seasonNum = parseInt(season);

        if (isNaN(seasonNum)) {
          return res.status(400).json({ message: "Invalid season number" });
        }

        const files = await storage.getMetadataBySeason(
          title,
          seasonNum,
          permissions!,
        );

        if (!files || files.length === 0) {
          return res
            .status(404)
            .json({ message: "No files found for this season" });
        }

        const transformedFiles = files.map(transformFileForDownload);

        if (format === "xml") {
          // Build XML with multiple items using fluent API
          const root = create({ version: '1.0' }).ele('season');
          transformedFiles.forEach(file => {
            const item = root.ele('item');
            buildItemXml(file, item);
            item.up();
          });
          const xml = root.end({ prettyPrint: true });

          const filename = title.replace(/[^a-z0-9]/gi, "_").toLowerCase();
          res.setHeader("Content-Type", "application/xml");
          res.setHeader(
            "Content-Disposition",
            `attachment; filename="${filename}_season${seasonNum}.xml"`,
          );
          res.send(xml);
        } else if (format === "xlsx") {
          // Use raw files for XLSX to avoid boolean normalization issues
          const wb = buildMetadataXlsx(files);
          const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

          const filename = title.replace(/[^a-z0-9]/gi, "_").toLowerCase();
          res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
          res.setHeader(
            "Content-Disposition",
            `attachment; filename="${filename}_season${seasonNum}.xlsx"`,
          );
          res.send(buffer);
        } else {
          const filename = title.replace(/[^a-z0-9]/gi, "_").toLowerCase();
          res.setHeader("Content-Type", "application/json");
          res.setHeader(
            "Content-Disposition",
            `attachment; filename="${filename}_season${seasonNum}.json"`,
          );
          res.json(transformedFiles);
        }
      } catch (error) {
        console.error("Error downloading season:", error);
        res.status(500).json({ message: "Failed to download season" });
      }
    },
  );

  app.get(
    "/api/metadata/download/season/:title/:season",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const userId = (req.user as any)?.id;
        if (!userId) {
          return res.status(401).json({ message: "Unauthorized" });
        }

        const { allowed, permissions, reason } = await requirePermission(
          userId,
          "read",
        );

        if (!allowed) {
          const statusCode = permissions?.user.status === "pending" ? 423 : 403;
          return res.status(statusCode).json({ message: reason });
        }

        const { title, season } = req.params;
        const seasonNum = parseInt(season);

        if (isNaN(seasonNum)) {
          return res.status(400).json({ message: "Invalid season number" });
        }

        const files = await storage.getMetadataBySeason(
          title,
          seasonNum,
          permissions!,
        );

        if (!files || files.length === 0) {
          return res
            .status(404)
            .json({ message: "No files found for this season" });
        }

        const transformedFiles = files.map(transformFileForDownload);
        const filename = title.replace(/[^a-z0-9]/gi, "_").toLowerCase();
        res.setHeader("Content-Type", "application/json");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="${filename}_season${seasonNum}.json"`,
        );
        res.json({ files: transformedFiles, count: transformedFiles.length });
      } catch (error) {
        console.error("Error downloading season:", error);
        res.status(500).json({ message: "Failed to download season" });
      }
    },
  );

  app.get(
    "/api/metadata/:id/download",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const userId = (req.user as any)?.id;
        if (!userId) {
          return res.status(401).json({ message: "Unauthorized" });
        }

        const { allowed, permissions, reason } = await requirePermission(
          userId,
          "read",
        );

        if (!allowed) {
          const statusCode = permissions?.user.status === "pending" ? 423 : 403;
          return res.status(statusCode).json({ message: reason });
        }

        const file = await storage.getMetadataFile(req.params.id, permissions!);
        if (!file) {
          return res.status(404).json({ message: "File not found" });
        }

        const transformedFile = transformFileForDownload(file);
        const format = (req.query.format as string) || "json";

        if (format === "xml") {
          const xml = buildMetadataXml(transformedFile);

          res.setHeader("Content-Type", "application/xml");
          res.setHeader(
            "Content-Disposition",
            `attachment; filename="${transformedFile.id}.xml"`,
          );
          res.send(xml);
        } else if (format === "xlsx") {
          // Use raw file for XLSX to avoid boolean normalization issues
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
    },
  );

  app.get(
    "/api/metadata/:id/adjacent",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const userId = (req.user as any)?.id;
        if (!userId) {
          return res.status(401).json({ message: "Unauthorized" });
        }

        const { allowed, permissions, reason } = await requirePermission(
          userId,
          "read",
        );

        if (!allowed) {
          const statusCode = permissions?.user.status === "pending" ? 423 : 403;
          return res.status(statusCode).json({ message: reason });
        }

        const adjacent = await storage.getAdjacentEpisodes(
          req.params.id,
          permissions!,
        );
        res.json(adjacent);
      } catch (error) {
        console.error("Error fetching adjacent episodes:", error);
        res.status(500).json({ message: "Failed to fetch adjacent episodes" });
      }
    },
  );

  app.get("/api/stats", isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any)?.id;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { allowed, permissions, reason } = await requirePermission(
        userId,
        "read",
      );

      if (!allowed) {
        const statusCode = permissions?.user.status === "pending" ? 423 : 403;
        return res.status(statusCode).json({ message: reason });
      }

      const stats = await storage.getStats(permissions!);
      res.json(stats);
    } catch (error) {
      console.error("Error fetching stats:", error);
      res.status(500).json({ message: "Failed to fetch stats" });
    }
  });

  app.get("/api/user-tags/:type", isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any).id;
      const type = req.params.type;

      if (type !== "genre" && type !== "contentType" && type !== "tags") {
        return res
          .status(400)
          .json({ message: "Invalid type. Must be 'genre', 'contentType', or 'tags'" });
      }

      const tags = await storage.getUserTags(userId, type);
      res.json(tags);
    } catch (error) {
      console.error("Error fetching user tags:", error);
      res.status(500).json({ message: "Failed to fetch user tags" });
    }
  });

  app.post("/api/user-tags", isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any).id;
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
  });

  app.delete("/api/user-tags/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any).id;
      const tagId = parseInt(req.params.id);

      if (isNaN(tagId)) {
        return res.status(400).json({ message: "Invalid tag ID" });
      }

      await storage.deleteUserTag(tagId, userId);
      res.json({ message: "Tag deleted successfully" });
    } catch (error) {
      console.error("Error deleting user tag:", error);
      res.status(500).json({ message: "Failed to delete user tag" });
    }
  });

  app.get(
    "/api/admin/users",
    isAuthenticated,
    isAdminUser,
    async (req: any, res) => {
      try {
        const users = await storage.listAllUsers();
        res.json({ users });
      } catch (error) {
        console.error("Error fetching all users:", error);
        res.status(500).json({ message: "Failed to fetch users" });
      }
    },
  );

  app.patch(
    "/api/admin/users/:userId",
    isAuthenticated,
    isAdminUser,
    async (req: any, res) => {
      try {
        const currentUserId = (req.user as any).id;
        const targetUserId = req.params.userId;

        const updateAdminSchema = z.object({
          isAdmin: z.boolean(),
        });

        const validation = updateAdminSchema.safeParse(req.body);

        if (!validation.success) {
          return res.status(400).json({
            message: "Validation failed",
            errors: validation.error.errors,
          });
        }

        if (currentUserId === targetUserId && !validation.data.isAdmin) {
          return res.status(400).json({
            message: "You cannot remove your own admin status",
          });
        }

        const updatedUser = await storage.updateUserAdminStatus(
          targetUserId,
          validation.data.isAdmin,
        );

        if (!updatedUser) {
          return res.status(404).json({ message: "User not found" });
        }

        res.json(updatedUser);
      } catch (error) {
        console.error("Error updating user admin status:", error);
        res.status(500).json({ message: "Failed to update user admin status" });
      }
    },
  );

  app.patch(
    "/api/admin/users/:userId/status",
    isAuthenticated,
    isAdminUser,
    async (req: any, res) => {
      try {
        const { userId } = req.params;

        const updateStatusSchema = z.object({
          status: z.enum(["active", "archived", "pending"]),
        });

        const validation = updateStatusSchema.safeParse(req.body);

        if (!validation.success) {
          return res.status(400).json({
            message: "Validation failed",
            errors: validation.error.errors,
          });
        }

        const updatedUser = await storage.updateUserStatus(
          userId,
          validation.data.status,
        );

        if (!updatedUser) {
          return res.status(404).json({ message: "User not found" });
        }

        res.json(updatedUser);
      } catch (error) {
        console.error("Error updating user status:", error);
        res.status(500).json({ message: "Failed to update user status" });
      }
    },
  );

  app.delete(
    "/api/admin/users/:userId",
    isAuthenticated,
    isAdminUser,
    async (req: any, res) => {
      try {
        const currentUserId = (req.user as any).id;
        const { userId } = req.params;

        if (currentUserId === userId) {
          return res.status(400).json({
            message: "You cannot delete yourself",
          });
        }

        const success = await storage.deleteUser(userId);

        if (!success) {
          return res.status(404).json({ message: "User not found" });
        }

        res.json({ message: "User deleted successfully" });
      } catch (error) {
        console.error("Error deleting user:", error);
        res.status(500).json({ message: "Failed to delete user" });
      }
    },
  );

  app.patch(
    "/api/admin/users/:userId/permissions",
    isAuthenticated,
    isAdminUser,
    async (req: any, res) => {
      try {
        const { userId } = req.params;

        const updatePermissionsSchema = z.object({
          canRead: z.number().int().min(0).max(1),
          canWrite: z.number().int().min(0).max(1),
          canEdit: z.number().int().min(0).max(1),
        });

        const validation = updatePermissionsSchema.safeParse(req.body);

        if (!validation.success) {
          return res.status(400).json({
            message: "Validation failed",
            errors: validation.error.errors,
          });
        }

        const updatedUser = await storage.updateUserPermissions(
          userId,
          validation.data,
        );

        if (!updatedUser) {
          return res.status(404).json({ message: "User not found" });
        }

        res.json(updatedUser);
      } catch (error) {
        console.error("Error updating user permissions:", error);
        res.status(500).json({ message: "Failed to update user permissions" });
      }
    },
  );

  app.patch(
    "/api/admin/users/:userId/visibility",
    isAuthenticated,
    isAdminUser,
    async (req: any, res) => {
      try {
        const { userId } = req.params;

        const updateVisibilitySchema = z.object({
          fileVisibility: z.enum(["own", "all", "group"]),
        });

        const validation = updateVisibilitySchema.safeParse(req.body);

        if (!validation.success) {
          return res.status(400).json({
            message: "Validation failed",
            errors: validation.error.errors,
          });
        }

        const { fileVisibility } = validation.data;

        // Validate that group visibility requires at least one group
        if (fileVisibility === "group") {
          const user = await storage.getUser(userId);
          if (!user) {
            return res.status(404).json({ message: "User not found" });
          }

          if (!user.groupIds || user.groupIds.length === 0) {
            return res.status(400).json({
              message:
                "Cannot set group visibility: user must be assigned to at least one group first",
            });
          }
        }

        const updatedUser = await storage.updateUserVisibility(
          userId,
          fileVisibility,
        );

        if (!updatedUser) {
          return res.status(404).json({ message: "User not found" });
        }

        res.json(updatedUser);
      } catch (error) {
        console.error("Error updating user visibility:", error);
        res.status(500).json({ message: "Failed to update user visibility" });
      }
    },
  );

  app.patch(
    "/api/admin/users/:userId/groups",
    isAuthenticated,
    isAdminUser,
    async (req: any, res) => {
      try {
        const { userId } = req.params;

        const updateGroupsSchema = z.object({
          groupIds: z.array(z.string()),
        });

        const validation = updateGroupsSchema.safeParse(req.body);

        if (!validation.success) {
          return res.status(400).json({
            message: "Validation failed",
            errors: validation.error.errors,
          });
        }

        // Validate all group IDs exist
        for (const groupId of validation.data.groupIds) {
          if (groupId) {
            const groups = await storage.getAllGroups();
            const groupExists = groups.some((g) => g.id === groupId);
            if (!groupExists) {
              return res
                .status(400)
                .json({ message: `Group ${groupId} not found` });
            }
          }
        }

        const updatedUser = await storage.updateUserGroups(
          userId,
          validation.data.groupIds,
        );

        if (!updatedUser) {
          return res.status(404).json({ message: "User not found" });
        }

        res.json(updatedUser);
      } catch (error) {
        console.error("Error updating user groups:", error);
        res.status(500).json({ message: "Failed to update user groups" });
      }
    },
  );

  app.get(
    "/api/admin/groups",
    isAuthenticated,
    isAdminUser,
    async (req: any, res) => {
      try {
        const groups = await storage.getAllGroups();
        res.json({ groups });
      } catch (error) {
        console.error("Error fetching groups:", error);
        res.status(500).json({ message: "Failed to fetch groups" });
      }
    },
  );

  app.post(
    "/api/admin/groups",
    isAuthenticated,
    isAdminUser,
    async (req: any, res) => {
      try {
        const createGroupSchema = z.object({
          name: z.string().min(1),
          description: z.string().optional(),
        });

        const validation = createGroupSchema.safeParse(req.body);

        if (!validation.success) {
          return res.status(400).json({
            message: "Validation failed",
            errors: validation.error.errors,
          });
        }

        const group = await storage.createGroup(validation.data);
        res.json(group);
      } catch (error) {
        console.error("Error creating group:", error);
        res.status(500).json({ message: "Failed to create group" });
      }
    },
  );

  app.delete(
    "/api/admin/groups/:groupId",
    isAuthenticated,
    isAdminUser,
    async (req: any, res) => {
      try {
        const { groupId } = req.params;

        const usersInGroup = await storage.getUsersByGroupId(groupId);

        if (usersInGroup.length > 0) {
          return res.status(400).json({
            message: `Cannot delete group. ${usersInGroup.length} user(s) are still assigned to this group.`,
            usersCount: usersInGroup.length,
          });
        }

        const success = await storage.deleteGroup(groupId);

        if (!success) {
          return res.status(404).json({ message: "Group not found" });
        }

        res.json({ message: "Group deleted successfully" });
      } catch (error) {
        console.error("Error deleting group:", error);
        res.status(500).json({ message: "Failed to delete group" });
      }
    },
  );

  // AI Configuration Routes
  app.get(
    "/api/admin/settings/ai",
    isAuthenticated,
    isAdminUser,
    async (req: any, res) => {
      try {
        const keys = ["ai_provider", "ai_model", "ai_api_key"];
        const settingsList = await storage.getSettingsByKeys(keys);
        
        // Mask the API key
        const sanitized = settingsList.map(s => {
          if (s.key === "ai_api_key" && s.value) {
            // Only mask if it's long enough
            const val = s.value;
            if (val.length > 8) {
              return { ...s, value: val.substring(0, 4) + "****" + val.substring(val.length - 4) };
            }
            return { ...s, value: "****" };
          }
          return s;
        });
        
        res.json({ settings: sanitized });
      } catch (error) {
        console.error("Error fetching AI settings:", error);
        res.status(500).json({ message: "Failed to fetch AI settings" });
      }
    },
  );

  app.post(
    "/api/admin/settings/ai",
    isAuthenticated,
    isAdminUser,
    async (req: any, res) => {
      try {
        const { provider, model, apiKey } = req.body;
        
        if (provider) await storage.setSetting("ai_provider", provider);
        if (model) await storage.setSetting("ai_model", model);
        if (apiKey && !apiKey.includes("****")) {
          await storage.setSetting("ai_api_key", apiKey);
        }
        
        res.json({ message: "AI settings updated successfully" });
      } catch (error) {
        console.error("Error updating AI settings:", error);
        res.status(500).json({ message: "Failed to update AI settings" });
      }
    },
  );

  // AI Upload Routes
  app.post(
    "/api/ai/parse-upload",
    isAuthenticated,
    upload.single("file"),
    async (req: any, res) => {
      try {
        const userId = (req.user as any)?.id;
        const permissions = await getUserPermissions(userId);
        if (!permissions || (permissions.user.canWrite === 0 && permissions.user.isAdmin === 0)) {
          return res.status(403).json({ message: "Write permission required" });
        }

        if (!req.file) {
          return res.status(400).json({ message: "No file uploaded" });
        }

        const type = req.body.type || "license";
        let proposals = [];

        if (type === "license") {
          const result = await aiService.parseLicenseContract(req.file.buffer, req.file.mimetype);
          proposals = result.proposals || [];
        } else if (type === "metadata") {
          const result = await aiService.parseMetadataDocument(req.file.buffer, req.file.mimetype, permissions);
          proposals = result.proposals;
        }

        res.json({ proposals });
      } catch (error: any) {
        console.error("Error in AI parse upload:", error);
        res.status(500).json({ message: error.message || "AI parsing failed" });
      }
    },
  );

  app.post(
    "/api/ai/refine-upload",
    isAuthenticated,
    upload.single("file"),
    async (req: any, res) => {
      try {
        const userId = (req.user as any)?.id;
        const permissions = await getUserPermissions(userId);
        if (!permissions || (permissions.user.canWrite === 0 && permissions.user.isAdmin === 0)) {
          return res.status(403).json({ message: "Write permission required" });
        }

        if (!req.file) {
          return res.status(400).json({ message: "No file uploaded" });
        }

        const type = req.body.type || "license";
        const feedback = req.body.feedback;
        const previousProposals = JSON.parse(req.body.previousProposals || "[]");

        if (!feedback) {
          return res.status(400).json({ message: "Feedback is required for refinement" });
        }

        const result = await aiService.refineParsing(
          req.file.buffer,
          req.file.mimetype,
          type,
          previousProposals,
          feedback,
          permissions
        );

        res.json({ proposals: result.proposals });
      } catch (error: any) {
        console.error("Error in AI refine upload:", error);
        res.status(500).json({ message: error.message || "AI refinement failed" });
      }
    },
  );

  app.post(
    "/api/ai/execute-proposal",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const userId = (req.user as any)?.id;
        const permissions = await getUserPermissions(userId);
        if (!permissions || (permissions.user.canWrite === 0 && permissions.user.isAdmin === 0)) {
          return res.status(403).json({ message: "Write permission required" });
        }

        const proposal = req.body;
        const { type, action, data } = proposal;

        if (type === "license") {
          if (action === "create") {
            // Convert date strings to Date objects
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
            // Default required fields if AI missed them
            const metadataToCreate = {
              ...data,
              duration: data.duration || "00:00:00",
              contentType: data.contentType || "Long Form",
            };
            const file = await storage.createMetadataFile(metadataToCreate, nextId, permissions);
            return res.json({ message: "Metadata file created successfully", id: file.id });
          } else if (action === "update") {
            const file = await storage.updateMetadataFile(data.id, data, permissions);
            return res.json({ message: "Metadata file updated successfully", id: file?.id });
          }
        }

        res.status(400).json({ message: "Invalid proposal or action" });
      } catch (error: any) {
        console.error("Error executing proposal:", error);
        res.status(500).json({ message: error.message || "Failed to execute proposal" });
      }
    },
  );

  // License Management Routes
  app.get("/api/licenses", isAuthenticated, async (req: any, res) => {
    try {
      const licenses = await storage.listLicenses();
      res.json(licenses);
    } catch (error) {
      console.error("Error fetching licenses:", error);
      res.status(500).json({ message: "Failed to fetch licenses" });
    }
  });

  app.post("/api/licenses", isAuthenticated, async (req: any, res) => {
    try {
      const createLicenseWithMetadataSchema = insertLicenseSchema.extend({
        metadataIds: z.array(z.string()).optional(),
        newBatches: z.array(z.any()).optional(),
      });

      const validation = createLicenseWithMetadataSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          message: "Validation failed",
          errors: validation.error.errors,
        });
      }

      const { metadataIds, newBatches, ...licenseData } = validation.data;
      const license = await storage.createLicense(licenseData);
      
      const userId = (req.user as any)?.id;
      const permissions = await getUserPermissions(userId);

      if (permissions) {
        // Link existing metadata
        if (metadataIds && metadataIds.length > 0) {
          await storage.bulkUpdateMetadata(
            metadataIds.map(id => ({ id, data: { licenseId: license.id } })),
            permissions
          );
        }

        // Create new batches
        if (newBatches && newBatches.length > 0) {
          await storage.createMultiBatchMetadataFiles(
            {
              batches: newBatches.map(batch => ({
                ...batch,
                licenseId: license.id
              }))
            },
            permissions
          );
        }
      }

      res.json(license);
    } catch (error) {
      console.error("Error creating license:", error);
      res.status(500).json({ message: "Failed to create license" });
    }
  });

  app.get("/api/licenses/:id", isAuthenticated, async (req: any, res) => {
    try {
      const license = await storage.getLicense(req.params.id);
      if (!license) {
        return res.status(404).json({ message: "License not found" });
      }
      res.json(license);
    } catch (error) {
      console.error("Error fetching license:", error);
      res.status(500).json({ message: "Failed to fetch license" });
    }
  });

  app.patch("/api/licenses/:id", isAuthenticated, async (req: any, res) => {
    try {
      const validation = insertLicenseSchema.partial().safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          message: "Validation failed",
          errors: validation.error.errors,
        });
      }

      const updated = await storage.updateLicense(req.params.id, validation.data);
      if (!updated) {
        return res.status(404).json({ message: "License not found" });
      }
      res.json(updated);
    } catch (error) {
      console.error("Error updating license:", error);
      res.status(500).json({ message: "Failed to update license" });
    }
  });

  app.delete("/api/licenses/:id", isAuthenticated, async (req: any, res) => {
    try {
      const success = await storage.deleteLicense(req.params.id);
      if (!success) {
        return res.status(404).json({ message: "License not found" });
      }
      res.json({ message: "License deleted successfully" });
    } catch (error) {
      console.error("Error deleting license:", error);
      res.status(500).json({ message: "Failed to delete license" });
    }
  });

  app.post("/api/licenses/batch-generate", isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any)?.id;
      const validation = licenseBatchGenerateSchema.safeParse(req.body);
      
      if (!validation.success) {
        return res.status(400).json({
          message: "Validation failed",
          errors: validation.error.errors,
        });
      }

      const files = await storage.generateLicenseDrafts(validation.data, userId);
      res.json({ message: "Drafts generated successfully", count: files.length, files });
    } catch (error) {
      console.error("Error generating license drafts:", error);
      res.status(500).json({ message: "Failed to generate drafts" });
    }
  });

  // Task Management Routes
  app.get("/api/tasks", isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any)?.id;
      const permissions = await getUserPermissions(userId);
      if (!permissions) return res.status(403).json({ message: "Unauthorized" });

      const { status } = req.query;
      const tasksList = await storage.listTasks(permissions, typeof status === "string" ? status : undefined);
      res.json(tasksList);
    } catch (error) {
      console.error("Error fetching tasks:", error);
      res.status(500).json({ message: "Failed to fetch tasks" });
    }
  });

  app.get("/api/metadata/:id/tasks", isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any)?.id;
      const permissions = await getUserPermissions(userId);
      if (!permissions) return res.status(403).json({ message: "Unauthorized" });

      const fileTasks = await storage.getTasksByFileId(req.params.id, permissions);
      res.json(fileTasks);
    } catch (error) {
      console.error("Error fetching file tasks:", error);
      res.status(500).json({ message: "Failed to fetch file tasks" });
    }
  });

  app.post("/api/tasks", isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any)?.id;
      const validation = insertTaskSchema.safeParse(req.body);
      
      if (!validation.success) {
        return res.status(400).json({
          message: "Validation failed",
          errors: validation.error.errors,
        });
      }

      const task = await storage.createTask({
        ...validation.data,
        createdBy: userId,
      });
      res.json(task);
    } catch (error) {
      console.error("Error creating task:", error);
      res.status(500).json({ message: "Failed to create task" });
    }
  });

  app.post("/api/tasks/bulk", isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any)?.id;
      const schema = z.object({
        metadataFileIds: z.array(z.string()).min(1),
        description: z.string().min(1),
      });

      const validation = schema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          message: "Validation failed",
          errors: validation.error.errors,
        });
      }

      const tasks = await storage.bulkCreateTasks({
        ...validation.data,
        createdBy: userId,
      });
      res.json(tasks);
    } catch (error) {
      console.error("Error creating bulk tasks:", error);
      res.status(500).json({ message: "Failed to create bulk tasks" });
    }
  });

  app.patch("/api/tasks/:id", isAuthenticated, async (req: any, res) => {
    try {
      const taskId = parseInt(req.params.id);
      if (isNaN(taskId)) return res.status(400).json({ message: "Invalid task ID" });

      const validation = insertTaskSchema.partial().safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          message: "Validation failed",
          errors: validation.error.errors,
        });
      }

      const updated = await storage.updateTask(taskId, validation.data);
      if (!updated) {
        return res.status(404).json({ message: "Task not found" });
      }
      res.json(updated);
    } catch (error) {
      console.error("Error updating task:", error);
      res.status(500).json({ message: "Failed to update task" });
    }
  });

  app.delete("/api/tasks/:id", isAuthenticated, async (req: any, res) => {
    try {
      const taskId = parseInt(req.params.id);
      if (isNaN(taskId)) return res.status(400).json({ message: "Invalid task ID" });

      const success = await storage.deleteTask(taskId);
      if (!success) {
        return res.status(404).json({ message: "Task not found" });
      }
      res.json({ message: "Task deleted successfully" });
    } catch (error) {
      console.error("Error deleting task:", error);
      res.status(500).json({ message: "Failed to delete task" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
