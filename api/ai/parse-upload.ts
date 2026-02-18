import type { VercelRequest, VercelResponse } from "@vercel/node";
import { aiService } from "../_server/ai-service.js";
import { withCors, requirePermission, type AuthenticatedRequest } from "../_lib/apiHandler.js";
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
    // Manually run multer
    await runMiddleware(req, res, upload.single("file"));
    
    const file = (req as any).file;
    if (!file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const type = req.body.type || "license";
    let proposals = [];

    if (type === "license") {
      const result = await aiService.parseLicenseContract(file.buffer, file.mimetype);
      proposals = (result.licenses || []).map((l: any) => ({
        type: "license",
        action: "create",
        data: l,
        explanation: `AI extracted license for "${l.content_title || l.name}" from ${l.distributor || "unknown distributor"}.`
      }));
    } else if (type === "metadata") {
      const result = await aiService.parseMetadataDocument(file.buffer, file.mimetype, req.permissions!);
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
  maxDuration: 60,
};

export default withCors(requirePermission("write")(handler));
