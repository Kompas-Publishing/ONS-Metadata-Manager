import type { VercelResponse } from "@vercel/node";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { withCors, requirePermission, type AuthenticatedRequest } from "../_lib/apiHandler.js";
import { storage } from "../_server/storage.js";

async function handler(req: AuthenticatedRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const body = req.body as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request: req as any,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        // Here you can check if the user is allowed to upload
        // clientPayload can contain information like the type of upload (avatar vs ai)
        
        const payload = clientPayload ? JSON.parse(clientPayload) : {};
        const uploadType = payload.type || "unknown";

        // Basic authorization check
        if (!req.user) {
          throw new Error("Unauthorized");
        }

        return {
          allowedContentTypes: ["image/jpeg", "image/png", "image/gif", "application/pdf", "text/csv", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "text/plain"],
          tokenPayload: JSON.stringify({
            userId: req.user.id,
            uploadType,
          }),
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        // This code runs on the Vercel server, not the client
        try {
          const { userId, uploadType } = JSON.parse(tokenPayload!);

          if (uploadType === "avatar") {
            // Update the user's profile image URL in the database
            await storage.updateUserProfile(userId, { profileImageUrl: blob.url });
          }
          // For AI uploads, we don't necessarily need to do anything here
          // as the client will send the URL to the parse-upload endpoint
        } catch (error) {
          throw new Error("Could not update user profile");
        }
      },
    });

    return res.status(200).json(jsonResponse);
  } catch (error) {
    return res.status(400).json({ error: (error as Error).message });
  }
}

export default withCors(requirePermission()(handler));
