import type { VercelRequest, VercelResponse } from "@vercel/node";
import { aiService } from "../_server/ai-service.js";
import { withCors, requirePermission, type AuthenticatedRequest } from "../_lib/apiHandler.js";
import multer from "multer";

// Multer configuration
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 4.5 * 1024 * 1024 }
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
    const feedback = req.body.feedback;
    const previousProposals = JSON.parse(req.body.previousProposals || "[]");

    if (!feedback) {
      return res.status(400).json({ message: "Feedback is required for refinement" });
    }

    const result = await aiService.refineParsing(
      file.buffer,
      file.mimetype,
      type,
      previousProposals,
      feedback,
      req.permissions
    );

    return res.status(200).json({ proposals: result.proposals });
  } catch (error: any) {
    console.error("Error in AI refine upload:", error);
    return res.status(500).json({ message: error.message || "AI refinement failed" });
  }
}

// Disable body parsing by Vercel to let multer handle it
export const config = {
  api: {
    bodyParser: false,
  },
  maxDuration: 300,
};

export default withCors(requirePermission("write")(handler));
