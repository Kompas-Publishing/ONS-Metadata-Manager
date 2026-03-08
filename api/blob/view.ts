import type { VercelResponse } from "@vercel/node";
import { apiHandler, requireAuth, isValidBlobUrl, type AuthenticatedRequest } from "../_lib/apiHandler";

/**
 * Proxy endpoint to view private blobs.
 * Requires authentication and strict URL validation to prevent SSRF and token leakage.
 */
async function handler(req: AuthenticatedRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const { url } = req.query;

  if (!url || typeof url !== 'string') {
    return res.status(400).json({ message: "Missing blob URL" });
  }

  // Pentest Fix: Use strict hostname validation instead of .includes()
  if (!isValidBlobUrl(url)) {
    console.warn(`Blocked potentially malicious blob proxy request to: ${url}`);
    return res.status(403).json({ message: "Invalid blob URL origin" });
  }

  try {
    const blobRes = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}`
      }
    });

    if (!blobRes.ok) {
      return res.status(blobRes.status).json({ message: "Failed to retrieve blob" });
    }

    // Set appropriate content type from the blob response
    const contentType = blobRes.headers.get('content-type');
    if (contentType) {
      res.setHeader('Content-Type', contentType);
    }

    // Cache the image for 1 hour
    res.setHeader('Cache-Control', 'public, max-age=3600');

    const buffer = Buffer.from(await blobRes.arrayBuffer());
    return res.send(buffer);
  } catch (error) {
    console.error("Error proxying blob:", error);
    return res.status(500).json({ message: "Error retrieving blob" });
  }
}

// Pentest Fix: Wrap with requireAuth to ensure only authenticated users can use the proxy
export default apiHandler(requireAuth(handler));
