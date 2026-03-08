import type { VercelResponse } from "@vercel/node";
import { runAiChat } from "../../../_server/ai-chat.js";
import { apiHandler, requirePermission, isValidBlobUrl, type AuthenticatedRequest } from "../../../_lib/apiHandler.js";

export default apiHandler(
  requirePermission("aiChat")(async (req: AuthenticatedRequest, res: VercelResponse) => {
    if (req.method !== "POST") {
      return res.status(405).json({ message: "Method not allowed" });
    }

    try {
      const messages = Array.isArray(req.body?.messages) ? req.body.messages : [];
      const debug = Boolean(req.body?.debug);

      const blobUrl = typeof req.body?.blobUrl === "string" ? req.body.blobUrl : "";
      const fileName =
        typeof req.body?.fileName === "string" && req.body.fileName.trim()
          ? req.body.fileName
          : "attachment";
      const mimeTypeOverride = typeof req.body?.mimeType === "string" ? req.body.mimeType : undefined;
      const MAX_CHAT_FILE_SIZE = 100 * 1024 * 1024;

      let attachment;
      if (blobUrl) {
        // Pentest Fix: Use centralized validation helper
        if (!isValidBlobUrl(blobUrl)) {
          return res.status(400).json({ message: "Invalid blob URL." });
        }

        const blobRes = await fetch(blobUrl, {
          headers: {
            'Authorization': `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}`
          }
        });
        if (!blobRes.ok) throw new Error(`Failed to fetch blob from Vercel: ${blobRes.statusText}`);

        const contentLength = blobRes.headers.get("content-length");
        if (contentLength && Number(contentLength) > MAX_CHAT_FILE_SIZE) {
          return res.status(400).json({ message: "File too large. Max file size is 100MB." });
        }

        const fileBuffer = Buffer.from(await blobRes.arrayBuffer());
        const mimeType = blobRes.headers.get("content-type") || mimeTypeOverride || "application/octet-stream";

        attachment = {
          fileName,
          mimeType,
          buffer: fileBuffer,
        };
      }

      const result = await runAiChat(messages, req.permissions!, { debug, attachment });
      return res.json(result);
    } catch (error: any) {
      console.error("Error in AI chat:", error);
      return res.status(500).json({ message: error.message || "AI chat failed" });
    }
  })
);
