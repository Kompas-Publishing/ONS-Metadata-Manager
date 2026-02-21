import type { VercelResponse } from "@vercel/node";
import { handleUpload, type HandleUploadBody } from "@vercel/blob";
import { corsMiddleware, authenticate, type AuthenticatedRequest } from "../_lib/apiHandler.js";
import { storage } from "../_server/storage.js";
import { requirePermission as checkPermission } from "../_server/permissions.js";

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
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      throw new Error("BLOB_READ_WRITE_TOKEN is not configured on the server");
    }

    const body = req.body as HandleUploadBody;
    if (!body) {
      return res.status(400).json({ error: "Missing request body" });
    }

    const jsonResponse = await handleUpload({
      body,
      request: req as any,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        // Authenticate inside the callback
        const user = await authenticate(req);
        
        if (!user) {
          throw new Error("Unauthorized: Please log in to upload files.");
        }

        if (user.status !== "active") {
          throw new Error("Unauthorized: Your account is not active.");
        }

        const payload = clientPayload ? JSON.parse(clientPayload) : {};
        const uploadType = payload.type || "unknown";

        // If it's an AI upload, check if the user has AI permission
        if (uploadType === "ai-upload") {
          const { allowed } = await checkPermission(user.id, "ai");
          if (!allowed) {
            throw new Error("Forbidden: You do not have permission to use the AI uploader.");
          }
        }

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
          console.error("Error in onUploadCompleted callback:", error);
        }
      },
    });

    return res.status(200).json(jsonResponse);
  } catch (error: any) {
    console.error("Vercel Blob handler error:", error);
    return res.status(500).json({ 
      message: "Vercel Blob error",
      error: error.message || "Internal Server Error"
    });
  }
}

export const config = {
  api: {
    bodyParser: true,
  },
};
