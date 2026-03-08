import type { VercelRequest, VercelResponse } from "@vercel/node";
import { aiService } from "../_server/ai-service";
import { withCors, requirePermission, isValidBlobUrl, type AuthenticatedRequest } from "../_lib/apiHandler";
import multer from "multer";

// Multer configuration
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 4.5 * 1024 * 1024 } // Vercel has a 4.5MB body limit
});

// Helper to run middleware
function runMiddleware(req: any, res: any, fn: any) {
  return new Promise((resolve, reject) => {
    fn(req, res, (result: any) => {
      if (result instanceof Error) {
        return reject(result);
      }
      return resolve(result);
    });
  });
}

async function handler(req: AuthenticatedRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    let fileBuffer: Buffer;
    let mimeType: string;
    let type: string;

    // Check content type to decide how to parse
    const contentType = req.headers["content-type"] || "";
    
    if (contentType.includes("application/json")) {
      // Manually parse JSON body since bodyParser is false
      const chunks = [];
      for await (const chunk of req) {
        chunks.push(chunk);
      }
      const body = JSON.parse(Buffer.concat(chunks).toString());
      
      if (body.blobUrl) {
        // Pentest Fix: Validate blob URL before fetching
        if (!isValidBlobUrl(body.blobUrl)) {
          return res.status(400).json({ message: "Invalid blob URL origin" });
        }

        const blobRes = await fetch(body.blobUrl, {
          headers: { 'Authorization': `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}` }
        });
        if (!blobRes.ok) throw new Error(`Failed to fetch blob from Vercel: ${blobRes.statusText}`);
        fileBuffer = Buffer.from(await blobRes.arrayBuffer());
        mimeType = blobRes.headers.get("content-type") || "application/octet-stream";
        type = body.type || "license";
      } else {
        return res.status(400).json({ message: "Missing blobUrl in JSON request" });
      }
    } else {
      // Use multer for multipart/form-data
      await runMiddleware(req, res, upload.single("file"));
      const file = (req as any).file;
      if (!file) {
        return res.status(400).json({ message: "No file uploaded" });
      }
      fileBuffer = file.buffer;
      mimeType = file.mimetype;
      type = req.body.type || "license";
    }

    let proposals = [];

    if (type === "license") {
      const result = await aiService.parseLicenseContract(fileBuffer, mimeType);
      proposals = result.proposals || [];
    } else if (type === "metadata") {
      const result = await aiService.parseMetadataDocument(fileBuffer, mimeType, req.permissions!);
      proposals = result.proposals;
    }

    return res.status(200).json({ proposals });
  } catch (error: any) {
    console.error("Error in AI parse upload:", error);
    return res.status(500).json({ message: error.message || "AI parsing failed" });
  }
}

// Disable body parsing by Vercel to let multer handle it
export const config = {
  api: {
    bodyParser: false,
  },
  maxDuration: 300,
};

export default withCors(requirePermission("ai")(handler));
