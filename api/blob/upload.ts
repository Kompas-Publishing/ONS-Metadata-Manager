import type { VercelResponse } from "@vercel/node";
import { handleUpload, type HandleUploadBody } from "@vercel/blob";
import { corsMiddleware, authenticate, type AuthenticatedRequest } from "../_lib/apiHandler.js";

export default async function handler(req: AuthenticatedRequest, res: VercelResponse) {
  // Manual CORS handling
  corsMiddleware(req, res);
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    const token = process.env.BLOB_READ_WRITE_TOKEN;
    if (!token) {
      return res.status(500).json({ error: "BLOB_READ_WRITE_TOKEN is missing from environment" });
    }

    const body = req.body as HandleUploadBody;

    // Use standard imports at top level if possible, or dynamic if needed.
    // Let's stick to dynamic for now to be safe against init errors.
    const { storage } = await import("../_server/storage.js");
    const { requirePermission: checkPermission } = await import("../_server/permissions.js");

    const jsonResponse = await handleUpload({
      body,
      request: req as any,
      token: token,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        // Step 1: Authenticate the user
        let user;
        try {
          user = await authenticate(req);
        } catch (e) {
          throw new Error("Authentication failed during handshake");
        }
        
        if (!user) {
          throw new Error("Unauthorized: You must be logged in to upload.");
        }

        if (user.status !== "active") {
          throw new Error("Unauthorized: Your account is pending or archived.");
        }

        const payload = clientPayload ? JSON.parse(clientPayload) : {};
        const uploadType = payload.type || "unknown";

        // Step 2: Check specific permissions
        if (uploadType === "ai-upload") {
          const { allowed } = await checkPermission(user.id, "ai");
          if (!allowed) {
            throw new Error("Forbidden: AI Upload permission required.");
          }
        }

        // Step 3: Return the token instructions
        return {
          allowedContentTypes: [
            "image/jpeg", "image/png", "image/gif", "image/webp",
            "application/pdf", "text/csv", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "text/plain"
          ],
          tokenPayload: JSON.stringify({
            userId: user.id,
            uploadType,
          }),
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        try {
          if (!tokenPayload) return;
          const { userId, uploadType } = JSON.parse(tokenPayload);

          if (uploadType === "avatar") {
            await storage.updateUserProfile(userId, { profileImageUrl: blob.url });
          }
        } catch (error) {
          console.error("onUploadCompleted error:", error);
        }
      },
    });

    return res.status(200).json(jsonResponse);
  } catch (error: any) {
    console.error("Blob Handler Exception:", error);
    // Ensure we ALWAYS return a valid JSON response even on failure
    return res.status(error.message?.includes("Unauthorized") ? 401 : 500).json({ 
      message: "Handshake failed",
      error: error.message || "Unknown error"
    });
  }
}

export const config = {
  api: {
    bodyParser: true,
  },
};
