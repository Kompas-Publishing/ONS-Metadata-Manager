import type { VercelResponse } from "@vercel/node";
import { aiService, type ContractIngestLicense } from "../../shared/ai-service.js";
import { storage } from "../../shared/storage.js";
import { withCors, requirePermission, isValidBlobUrl, type AuthenticatedRequest } from "../_lib/apiHandler.js";
import multer from "multer";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 4.5 * 1024 * 1024 },
});

function runMiddleware(req: any, res: any, fn: any) {
  return new Promise((resolve, reject) => {
    fn(req, res, (result: any) => {
      if (result instanceof Error) return reject(result);
      return resolve(result);
    });
  });
}

interface IngestSummary {
  classification: string;
  contractMode: string | null;
  contractId: string | null;
  contractAction: "created" | "updated";
  licensesCreated: number;
  licensesUpdated: number;
  seriesLinksCreated: number;
  metadataLinksCreated: number;
  newContentRows: number;
  warnings: string[];
  licenseDetails: Array<{
    id: string;
    name: string;
    action: "created" | "updated";
    contentItems: number;
  }>;
}

async function handler(req: AuthenticatedRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ message: "Unauthorized" });

  try {
    // --- 1. Get file buffer ---
    let fileBuffer: Buffer;
    let mimeType: string;
    let fileName: string;
    let blobUrl: string | undefined;

    const contentType = req.headers["content-type"] || "";

    if (contentType.includes("application/json")) {
      const chunks: Buffer[] = [];
      for await (const chunk of req) {
        chunks.push(chunk as Buffer);
      }
      const body = JSON.parse(Buffer.concat(chunks).toString());

      if (!body.blobUrl) {
        return res.status(400).json({ message: "Missing blobUrl" });
      }
      if (!isValidBlobUrl(body.blobUrl)) {
        return res.status(400).json({ message: "Invalid blob URL origin" });
      }

      blobUrl = body.blobUrl;
      fileName = body.fileName || "contract.pdf";

      const blobRes = await fetch(body.blobUrl, {
        headers: { Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}` },
      });
      if (!blobRes.ok) throw new Error(`Failed to fetch blob: ${blobRes.statusText}`);
      fileBuffer = Buffer.from(await blobRes.arrayBuffer());
      mimeType = blobRes.headers.get("content-type") || "application/octet-stream";
    } else {
      await runMiddleware(req, res, upload.single("file"));
      const file = (req as any).file;
      if (!file) return res.status(400).json({ message: "No file uploaded" });
      fileBuffer = file.buffer;
      mimeType = file.mimetype;
      fileName = file.originalname || "contract.pdf";
    }

    // --- 2. AI Parsing ---
    const ingestResult = await aiService.parseContractForIngest(fileBuffer, mimeType);
    const warnings: string[] = [...ingestResult.warnings];

    // If not ingestible, still create contract record as "issue"
    if (ingestResult.classification !== "inbound_license" && ingestResult.classification !== "amendment") {
      const contract = await storage.createContract({
        name: ingestResult.contractName,
        distributor: ingestResult.distributor,
        status: "issue",
        notes: `[${ingestResult.classification}] ${ingestResult.notes}`,
        totalFeeAmount: ingestResult.totalFee || undefined,
        totalFeeCurrency: ingestResult.currency,
        createdBy: userId,
      });

      // Attach file
      if (blobUrl) {
        await storage.addContractFile({
          contractId: contract.id,
          fileUrl: blobUrl,
          fileName,
          fileRole: "main",
        });
      }

      return res.status(200).json({
        classification: ingestResult.classification,
        contractMode: null,
        contractId: contract.id,
        contractAction: "created",
        licensesCreated: 0,
        licensesUpdated: 0,
        seriesLinksCreated: 0,
        metadataLinksCreated: 0,
        newContentRows: 0,
        warnings: [
          `Contract classified as "${ingestResult.classification}" — not ingested as inbound rights.`,
          ...warnings,
        ],
        licenseDetails: [],
      } satisfies IngestSummary);
    }

    // --- 3. Upsert Contract ---
    const existingContract = await storage.findContractByNameAndDistributor(
      ingestResult.contractName,
      ingestResult.distributor,
    );

    let contract;
    let contractAction: "created" | "updated";
    // Store AI extraction in sharedTerms for audit trail
    const sharedTermsWithAudit = {
      ...(ingestResult.sharedTerms || {}),
      _aiClassification: ingestResult.classification,
      _aiExtraction: ingestResult.rawExtraction,
    };

    if (existingContract) {
      contract = await storage.updateContract(existingContract.id, {
        status: "imported",
        contractMode: ingestResult.contractMode || undefined,
        notes: ingestResult.notes || existingContract.notes || undefined,
        totalFeeAmount: ingestResult.totalFee || existingContract.totalFeeAmount || undefined,
        totalFeeCurrency: ingestResult.currency,
        sharedTerms: sharedTermsWithAudit as any,
      });
      contract = contract || existingContract;
      contractAction = "updated";
    } else {
      contract = await storage.createContract({
        name: ingestResult.contractName,
        distributor: ingestResult.distributor,
        status: "imported",
        contractMode: ingestResult.contractMode || undefined,
        notes: ingestResult.notes || undefined,
        totalFeeAmount: ingestResult.totalFee || undefined,
        totalFeeCurrency: ingestResult.currency,
        sharedTerms: sharedTermsWithAudit as any,
        createdBy: userId,
      });
      contractAction = "created";
    }

    // Attach file to contract
    if (blobUrl) {
      await storage.addContractFile({
        contractId: contract.id,
        fileUrl: blobUrl,
        fileName,
        fileRole: "main",
      });
    }

    // --- 4. Process Licenses ---
    let licensesCreated = 0;
    let licensesUpdated = 0;
    let seriesLinksCreated = 0;
    let metadataLinksCreated = 0;
    let newContentRows = 0;
    const licenseDetails: IngestSummary["licenseDetails"] = [];

    for (const licSpec of ingestResult.licenses) {
      try {
        const licenseResult = await processLicense(licSpec, contract.id, userId, warnings);
        if (licenseResult.action === "created") licensesCreated++;
        else licensesUpdated++;
        seriesLinksCreated += licenseResult.seriesLinks;
        metadataLinksCreated += licenseResult.metadataLinks;
        newContentRows += licenseResult.newContent;
        licenseDetails.push({
          id: licenseResult.licenseId,
          name: licSpec.name,
          action: licenseResult.action,
          contentItems: licSpec.contentItems?.length || 0,
        });
      } catch (err: any) {
        warnings.push(`Failed to process license "${licSpec.name}": ${err.message}`);
      }
    }

    return res.status(200).json({
      classification: ingestResult.classification,
      contractMode: ingestResult.contractMode,
      contractId: contract.id,
      contractAction,
      licensesCreated,
      licensesUpdated,
      seriesLinksCreated,
      metadataLinksCreated,
      newContentRows,
      warnings,
      licenseDetails,
    } satisfies IngestSummary);
  } catch (error: any) {
    console.error("Contract ingest error:", error);
    return res.status(500).json({ message: error.message || "Contract ingest failed" });
  }
}

/** Process a single license from the AI extraction */
async function processLicense(
  spec: ContractIngestLicense,
  contractId: string,
  userId: string,
  warnings: string[],
): Promise<{
  licenseId: string;
  action: "created" | "updated";
  seriesLinks: number;
  metadataLinks: number;
  newContent: number;
}> {
  let licenseId: string;
  let action: "created" | "updated";
  let seriesLinks = 0;
  let metadataLinks = 0;
  let newContent = 0;

  // Build license data
  const licenseData = {
    name: spec.name,
    distributor: spec.distributor,
    contentTitle: spec.contentTitle || spec.name,
    season: spec.season || "1",
    licenseFeeAmount: spec.licenseFeeAmount || undefined,
    licenseFeeCurrency: spec.licenseFeeCurrency || "EUR",
    licenseFeePaid: spec.licenseFeePaid || 0,
    licenseStart: spec.licenseStart ? new Date(spec.licenseStart) : undefined,
    licenseEnd: spec.licenseEnd ? new Date(spec.licenseEnd) : undefined,
    allowedRuns: spec.allowedRuns || undefined,
    productionYear: spec.productionYear || undefined,
    subsFromDistributor: spec.subsFromDistributor || 0,
    description: spec.description || undefined,
    notes: spec.notes || undefined,
  };

  // Try to find existing license (dedup)
  if (spec.action === "update" && spec.existingLicenseId) {
    const existing = await storage.getLicense(spec.existingLicenseId);
    if (existing) {
      await storage.updateLicense(existing.id, licenseData);
      licenseId = existing.id;
      action = "updated";
    } else {
      // ID not found, try matching
      const match = await storage.findMatchingLicense({
        name: spec.name,
        distributor: spec.distributor,
        season: spec.season,
        licenseStart: spec.licenseStart ? new Date(spec.licenseStart) : undefined,
        licenseEnd: spec.licenseEnd ? new Date(spec.licenseEnd) : undefined,
      });
      if (match) {
        await storage.updateLicense(match.id, licenseData);
        licenseId = match.id;
        action = "updated";
      } else {
        const created = await storage.createLicense(licenseData);
        licenseId = created.id;
        action = "created";
      }
    }
  } else {
    // Check for duplicates before creating
    const match = await storage.findMatchingLicense({
      name: spec.name,
      distributor: spec.distributor,
      season: spec.season,
      licenseStart: spec.licenseStart ? new Date(spec.licenseStart) : undefined,
      licenseEnd: spec.licenseEnd ? new Date(spec.licenseEnd) : undefined,
    });
    if (match) {
      await storage.updateLicense(match.id, licenseData);
      licenseId = match.id;
      action = "updated";
      warnings.push(`License "${spec.name}" matched existing license (${match.id}) — updated instead of creating duplicate.`);
    } else {
      const created = await storage.createLicense(licenseData);
      licenseId = created.id;
      action = "created";
    }
  }

  // Link license to contract with provenance
  await storage.linkContractToLicense({
    contractId,
    licenseId,
    sourceTitle: spec.name,
    sourceTitles: spec.contentItems?.map(i => i.title) || null,
    sourceSnapshot: spec as any,
    mappingStatus: "mapped",
    notes: spec.explanation,
  });

  // --- Content Linking ---
  for (const item of spec.contentItems || []) {
    try {
      // Try to find existing series
      let seriesId = item.matchedSeriesId;

      if (!seriesId) {
        const existingSeries = await storage.findSeriesByTitleFuzzy(item.title);
        if (existingSeries) {
          seriesId = existingSeries.id;
        }
      }

      // Try to find existing metadata for this title+season
      const existingMetadata = await storage.findMetadataBySeriesAndSeason(item.title, item.season);

      if (existingMetadata.length > 0) {
        // Safe match: we found metadata for this exact title+season
        // Link at metadata level
        const metadataIds = existingMetadata.map(m => m.id);
        const linked = await storage.linkMetadataToLicense(licenseId, metadataIds);
        metadataLinks += linked;
      } else if (seriesId) {
        // No episode-level match, but series exists — link at series level (safer)
        const seasonStr = item.season ? String(item.season) : undefined;
        await storage.linkSeriesToLicense(seriesId, licenseId, seasonStr);
        seriesLinks++;
      } else {
        // No existing content — create minimal draft content
        // Only create series if we have a title
        if (item.title) {
          const series = await storage.upsertSeries({
            title: item.title,
            productionYear: spec.productionYear || undefined,
          });
          seriesId = series.id;

          // Link series to license
          const seasonStr = item.season ? String(item.season) : undefined;
          await storage.linkSeriesToLicense(series.id, licenseId, seasonStr);
          seriesLinks++;

          // Only create metadata drafts if we know episode count
          if (item.episodes > 0) {
            const drafts = await storage.generateLicenseDrafts({
              licenseId,
              seriesTitle: item.title,
              seasonStart: item.season || 1,
              seasonEnd: item.season || 1,
              episodesPerSeason: item.episodes,
            }, userId);
            newContent += drafts.length;
          }
        }
      }
    } catch (err: any) {
      warnings.push(`Content linking for "${item.title}" S${item.season}: ${err.message}`);
    }
  }

  return { licenseId, action, seriesLinks, metadataLinks, newContent };
}

export const config = {
  api: { bodyParser: false },
  maxDuration: 300,
};

export default withCors(requirePermission("contracts")(handler));
