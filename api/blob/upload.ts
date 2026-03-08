import type { VercelRequest, VercelResponse } from "@vercel/node";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { corsMiddleware, authenticate, type AuthenticatedRequest } from "../_lib/apiHandler.js";
import { storage } from "../_server/storage.js";
import { requirePermission as checkPermission } from "../_server/permissions.js";

export default async function handler(req: AuthenticatedRequest, res: VercelResponse) {
  // 1. Handle CORS and Options
  corsMiddleware(req, res);
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    // 2. Validate environment
    const token = process.env.BLOB_READ_WRITE_TOKEN;
    if (!token) {
      console.error("BLOB_READ_WRITE_TOKEN is missing");
      return res.status(500).json({ error: "Server configuration error: Blob token missing" });
    }

    const body = req.body as HandleUploadBody;

    // 3. Perform the handshake
    const jsonResponse = await handleUpload({
      body,
      request: req as any,
      token: token,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        // Authenticate the user session
        const user = await authenticate(req);
        
        if (!user) {
          throw new Error("Unauthorized: Please log in.");
        }

        if (user.status !== "active") {
          throw new Error("Account is not active.");
        }

        const payload = clientPayload ? JSON.parse(clientPayload) : {};
        const uploadType = payload.type || "unknown";

        // Permission check for AI uploads
        if (uploadType === "ai-upload") {
          const { allowed } = await checkPermission(user.id, "ai");
          if (!allowed) {
            throw new Error("You do not have permission to use the AI uploader.");
          }
        }

        if (uploadType === "ai-chat") {
          const { allowed } = await checkPermission(user.id, "aiChat");
          if (!allowed) {
            throw new Error("You do not have permission to use AI Chat.");
          }
        }

        const imageTypes = [
          "image/jpeg",
          "image/png",
          "image/gif",
          "image/webp",
          "image/bmp",
          "image/tiff",
        ];

        const aiUploadTypes = [
          ...imageTypes,
          "application/pdf",
          "text/csv",
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "text/plain",
        ];

        const aiChatTypes = [
          ...imageTypes,
          "application/pdf",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "application/rtf",
          "text/plain",
          "text/csv",
          "text/tab-separated-values",
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "application/vnd.ms-excel",
          "application/json",
          "text/json",
          "application/x-yaml",
          "text/yaml",
          "text/x-yaml",
          "application/yaml",
        ];

        return {
          allowedContentTypes:
            uploadType === "avatar"
              ? imageTypes
              : uploadType === "ai-chat"
                ? aiChatTypes
                : uploadType === "ai-upload"
                  ? aiUploadTypes
                  : imageTypes,
          addRandomSuffix: true,
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
    console.error("Vercel Blob Handshake Error:", error);
    const statusCode = error.message?.includes("Unauthorized") ? 401 : 400;
    return res.status(statusCode).json({ 
      error: error.message || "Upload initialization failed" 
    });
  }
}

export const config = {
  api: {
    bodyParser: true,
  },
};
