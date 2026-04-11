import { GoogleGenerativeAI } from "@google/generative-ai";
import { storage } from "./storage.js";
import {
  type InsertLicense,
  type InsertMetadataFile,
  type License,
  type MetadataFile
} from "./schema.js";
import { type UserPermissions } from "./permissions.js";
import * as XLSX from "xlsx";
import mammoth from "mammoth";

export interface ContractIngestLicense {
  action: "create" | "update";
  existingLicenseId: string | null;
  explanation: string;
  name: string;
  distributor: string;
  contentTitle: string;
  season: string;
  licenseFeeAmount: string | null;
  licenseFeeCurrency: string;
  licenseFeePaid: number;
  licenseStart: string | null;
  licenseEnd: string | null;
  allowedRuns: string | null;
  productionYear: number | null;
  subsFromDistributor: number;
  description: string | null;
  notes: string | null;
  contentItems: Array<{
    title: string;
    season: number;
    episodes: number;
    matchedSeriesId: string | null;
  }>;
}

export interface ContractPaymentTermEntry {
  year: number;
  amountCents: number;
  currency?: string;
  dueDate?: string | null;
  notes?: string | null;
}

export interface ContractIngestResult {
  classification: string;
  contractName: string;
  distributor: string;
  totalFee: string | null;
  currency: string;
  notes: string;
  contractMode: string | null;
  sharedTerms?: Record<string, string | null> | null;
  licenses: ContractIngestLicense[];
  paymentTerms?: ContractPaymentTermEntry[];
  warnings: string[];
  rawExtraction: any;
}

function parseAiJson(raw: string): any {
  const cleaned = raw.replace(/```json|```/g, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    throw new Error(`AI returned invalid JSON: ${cleaned.slice(0, 200)}`);
  }
}

export class AiService {
  genAI: GoogleGenerativeAI | null = null;
  model: string = "gemini-3-pro-preview";

  async initialize() {
    const apiKey = (await storage.getSetting("ai_api_key"))?.value;
    const provider = (await storage.getSetting("ai_provider"))?.value;
    const configuredModel = (await storage.getSetting("ai_model"))?.value;

    if (!apiKey || provider !== "google") {
      throw new Error("AI not configured. Please set the Gemini API key in the Admin panel.");
    }

    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = configuredModel || "gemini-3-pro-preview";
  }

  async extractTextFromBuffer(fileBuffer: Buffer, mimeType: string): Promise<string> {
    if (mimeType === "text/csv" || mimeType === "text/plain") {
      return fileBuffer.toString("utf-8");
    } else if (
      mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
      mimeType === "application/vnd.ms-excel"
    ) {
      const workbook = XLSX.read(fileBuffer, { type: "buffer" });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      return XLSX.utils.sheet_to_csv(worksheet);
    } else if (mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
      const result = await mammoth.extractRawText({ buffer: fileBuffer });
      return result.value;
    }
    // Fallback for other potential text formats
    return fileBuffer.toString("utf-8");
  }

  async parseLicenseContract(fileBuffer: Buffer, mimeType: string): Promise<any> {
    await this.initialize();
    if (!this.genAI) throw new Error("AI not initialized");

    const model = this.genAI.getGenerativeModel({ model: this.model });
    const isPdf = mimeType === "application/pdf";
    const extractedText = isPdf ? "" : await this.extractTextFromBuffer(fileBuffer, mimeType);

    // Phase 1: Extract basic info to find candidates
    const searchPrompt = `Task: Extract the license name and distributor from this contract.
Return ONLY a JSON object with "name" and "distributor" strings.

${!isPdf ? `The document content is as follows:\n\n${extractedText}` : ""}

Example: { "name": "Ballykissangel", "distributor": "BBC" }`;

    const phase1Content: any[] = [searchPrompt];
    if (isPdf) phase1Content.push({ inlineData: { data: fileBuffer.toString("base64"), mimeType } });

    const phase1Result = await model.generateContent(phase1Content);
    const searchData = parseAiJson(phase1Result.response.text());

    // Search DB for candidate licenses
    const allLicenses = await storage.listLicenses();
    const candidates = allLicenses.filter(l =>
      (l.distributor?.toLowerCase() === searchData.distributor?.toLowerCase()) ||
      (l.name.toLowerCase().includes(searchData.name?.toLowerCase()))
    ).slice(0, 10);

    const finalPrompt = `Role: Expert Legal Content Analyst.
Task: Extract contract data into a structured JSON array of "license" objects and compare against candidates to prevent duplicates.

Granularity Logic (STRICT):
* Group all content under ONE license object if they share the same financial terms (one price for the whole package).
* ONLY create separate license objects if specific titles have their own unique price or totally different contract dates.
* If most content has the same rules (e.g. 2 runs) but a few differ, capture the standard rule in "allowedRuns" and explain the exceptions in the "notes" field. Do not split the license.

Data Rules:
- Name: Use the Content Title and Season (e.g., "Ballykissangel Series 2"). DO NOT include legal headers like "Amendment Agreement".
- Allowed Runs: Extract ONLY the number (e.g. "2"). If not a number, use null. No text allowed here.
- Distributor Normalization: Use "MGM" instead of "MGM International Television Distribution Inc." and "BBC" instead of its full legal name.
- Comparison: If an entry in CANDIDATES matches the name and distributor AND has overlapping or identical dates, propose an "update" with that ID.
- NEW LICENSE TERMS: If the dates (start/end) are significantly different from the CANDIDATES (e.g., a new contract for a different year), propose a "create" action even if the name matches.
- Season Rule: If a season is 0 or missing, set it to 1.
- Production Year: Extract the original production year of the series or movie if available.
- Subtitles: Determine if ONS receives the subtitles from the distributor or needs to create/buy them. Set "subsFromDistributor" to 1 if the contract states ONS gets them, otherwise 0.

JSON Schema (MATCH EXACT DATABASE FIELDS):
{
  "proposals": [
    {
      "type": "license",
      "action": "create" | "update",
      "explanation": "string explaining why it matched or didn't",
      "data": {
        "id": "string (only if update)",
        "name": "string",
        "distributor": "string",
        "contentTitle": "string",
        "licenseFeeAmount": "string",
        "licenseFeeCurrency": "string",
        "licenseStart": "YYYY-MM-DD",
        "licenseEnd": "YYYY-MM-DD",
        "allowedRuns": number, (STRICTLY A NUMBER)
        "productionYear": number,
        "subsFromDistributor": 0 | 1,
        "description": "string",
        "notes": "string", (Include legal context or variation in rules here)
        "content_items": [{ "title": "string", "episodes": number, "season": number }]
      }
    }
  ]
}

${!isPdf ? `The document content is as follows:\n\n${extractedText}` : ""}

Only return the JSON object.`;

    const finalContent: any[] = [finalPrompt];
    if (isPdf) finalContent.push({ inlineData: { data: fileBuffer.toString("base64"), mimeType } });

    const finalResult = await model.generateContent(finalContent);
    const resultJson = parseAiJson(finalResult.response.text());

    // Enrich and normalize
    for (const p of resultJson.proposals || []) {
      if (p.data.content_items) {
        for (const item of p.data.content_items) {
          if (!item.season || item.season === 0) item.season = 1;
        }
      }
      if (p.action === "update" && p.data.id) {
        p.existingData = candidates.find(c => c.id === p.data.id);
      }
    }

    return resultJson;
  }

  async refineParsing(
    fileBuffer: Buffer,
    mimeType: string,
    type: "license" | "metadata",
    previousProposals: any[],
    userFeedback: string,
    permissions?: UserPermissions
  ): Promise<any> {
    await this.initialize();
    if (!this.genAI) throw new Error("AI not initialized");

    const model = this.genAI.getGenerativeModel({ model: this.model });
    const isPdf = mimeType === "application/pdf";
    const extractedText = isPdf ? "" : await this.extractTextFromBuffer(fileBuffer, mimeType);

    const refinementPrompt = `Role: Expert Data Analyst.
Task: You previously parsed the attached document and generated some proposals. The user has provided feedback because something was incorrect.

Upload Type: ${type}
User Feedback: "${userFeedback}"

Previous Proposals:
${JSON.stringify(previousProposals, null, 2)}

Instructions:
1. Re-analyze the document based on the user feedback.
2. Provide a new, corrected set of proposals following the exact same JSON schema as before.
3. If the user feedback indicates grouping issues, adjust the number of objects accordingly.
4. If the user feedback corrects specific values, ensure those are updated.
5. If you need to re-match against the database, use the information from the previous proposals.

JSON Schema:
{
  "proposals": [
    {
      "type": "${type}",
      "action": "create" | "update",
      "explanation": "string explaining why it changed or why it matched",
      "data": { ... fields appropriate for ${type} ... }
    }
  ]
}

${!isPdf ? `The document content is as follows:\n\n${extractedText}` : ""}

Only return the JSON object. Do not include markdown formatting.`;

    const content: any[] = [refinementPrompt];
    if (isPdf) content.push({ inlineData: { data: fileBuffer.toString("base64"), mimeType } });

    const result = await model.generateContent(content);
    const resultJson = parseAiJson(result.response.text());

    // Normalize results as in original methods
    for (const p of resultJson.proposals || []) {
      if (type === "license" && p.data.content_items) {
        for (const item of p.data.content_items) {
          if (!item.season || item.season === 0) item.season = 1;
        }
      } else if (type === "metadata") {
        if (p.data.season === 0 || p.data.season === null) {
          p.data.season = 1;
        }
      }

      // Try to restore existingData from previous proposals if the ID matches
      if (p.action === "update" && p.data.id) {
        const prev = previousProposals.find(pp => pp.data?.id === p.data.id);
        if (prev) {
          p.existingData = prev.existingData;
        }
      }
    }

    return resultJson;
  }

  async parseMetadataDocument(fileBuffer: Buffer, mimeType: string, permissions: UserPermissions): Promise<any> {
    await this.initialize();
    if (!this.genAI) throw new Error("AI not initialized");

    const model = this.genAI.getGenerativeModel({ model: this.model });
    const isPdf = mimeType === "application/pdf";
    const extractedText = isPdf ? "" : await this.extractTextFromBuffer(fileBuffer, mimeType);

    // Phase 1: Extract titles to find candidates
    const searchPrompt = `Task: Extract the series title or main title from this metadata document.
Return ONLY a JSON object with a "keywords" array of strings to search for in a database.

${!isPdf ? `The document content is as follows:\n\n${extractedText}` : ""}

Example: { "keywords": ["Holland Heritage", "Heritage"] }`;

    const phase1Content: any[] = [searchPrompt];
    if (isPdf) phase1Content.push({ inlineData: { data: fileBuffer.toString("base64"), mimeType } });

    const phase1Result = await model.generateContent(phase1Content);
    const keywordsData = parseAiJson(phase1Result.response.text());

    // Search DB for candidates
    let candidates: MetadataFile[] = [];
    for (const kw of keywordsData.keywords || []) {
      const results = await storage.searchMetadata(kw, permissions);
      candidates = [...candidates, ...results];
    }
    // De-duplicate candidates by ID
    const uniqueCandidates = Array.from(new Map(candidates.map(c => [c.id, c])).values());

    // Phase 2: Final parsing and comparison
    const finalPrompt = `Role: Expert Metadata Librarian.
Task: Extract metadata from the provided document and compare it against existing database entries to prevent duplicates.

Existing Database Candidates (CANDIDATES):
${JSON.stringify(uniqueCandidates.map(c => ({ id: c.id, title: c.title, seriesTitle: c.seriesTitle, season: c.season, episode: c.episode })), null, 2)}

Instructions:
1. Extract every metadata item found in the document.
2. For each extracted item:
   - Search the CANDIDATES list for an entry that matches (similar title + same season + same episode).
   - If a strong match is found: Propose an "update" action. Use the existing ID.
   - If no match is found: Propose a "create" action.
3. Be strict about duplicates. We do not want two entries for the same episode of the same series.
4. IMPORTANT: If a season is listed as 0 or missing, set it to 1. Our systems do not support season 0.

JSON Schema:
{
  "proposals": [
    {
      "type": "metadata",
      "action": "create" | "update",
      "explanation": "string explaining why it matched or didn't",
      "data": {
        "id": "string (only if update)",
        "title": "string",
        "seriesTitle": "string",
        "season": number,
        "episode": number,
        "episodeTitle": "string",
        "duration": "HH:MM:SS",
        "description": "string",
        "genre": ["string"],
        "actors": ["string"],
        "productionCountry": "string",
        "yearOfProduction": number,
        "originalFilename": "string",
        "programRating": "string",
        "channel": "string",
        "episodeCount": number,
        "segmented": 0 | 1,
        "catchUp": 0 | 1,
        "subtitles": 0 | 1,
        "breakTimes": ["HH:MM:SS"]
      }
    }
  ]
}

Instructions for Mapping Files:
- Breaktimes are often located in the final columns of the document. Look for multiple timestamp columns and group them into the "breakTimes" array.
- Duration is critical and must be in HH:MM:SS format.

${!isPdf ? `The document content is as follows:\n\n${extractedText}` : ""}

Only return the JSON object. Do not include markdown formatting.`;

    const finalContent: any[] = [finalPrompt];
    if (isPdf) finalContent.push({ inlineData: { data: fileBuffer.toString("base64"), mimeType } });

    const finalResult = await model.generateContent(finalContent);
    const resultJson = parseAiJson(finalResult.response.text());

    // Enrich proposals with existingData for UI comparison and normalize season
    for (const proposal of resultJson.proposals || []) {
      if (proposal.data.season === 0 || proposal.data.season === null) {
        proposal.data.season = 1;
      }
      if (proposal.action === "update" && proposal.data.id) {
        proposal.existingData = uniqueCandidates.find(c => c.id === proposal.data.id);
      }
    }

    return resultJson;
  }

  /**
   * Full contract ingest parsing — classifies the contract, extracts license structures,
   * derives content items, and returns a structured ingest plan.
   */
  async parseContractForIngest(fileBuffer: Buffer, mimeType: string): Promise<ContractIngestResult> {
    await this.initialize();
    if (!this.genAI) throw new Error("AI not initialized");

    const model = this.genAI.getGenerativeModel({ model: this.model });
    const isPdf = mimeType === "application/pdf";
    const extractedText = isPdf ? "" : await this.extractTextFromBuffer(fileBuffer, mimeType);

    // Phase 1: Classification + basic extraction
    const classifyPrompt = `Role: Expert Legal Contract Analyst for a broadcast television company (ONS).
Task: Classify and extract basic info from this contract document.

Return ONLY a JSON object with these fields:
{
  "classification": "inbound_license" | "amendment" | "outbound" | "invoice" | "issue",
  "contractName": "string — a descriptive name for the contract (e.g. 'BBC Nature Package 2025')",
  "distributor": "string — normalized short name (e.g. 'BBC' not 'BBC Studios Distribution Limited')",
  "totalFee": "string — total fee amount if found, or null",
  "currency": "EUR" | "USD" | "GBP",
  "notes": "string — brief summary of what this contract covers",
  "titles": ["array of content/programme titles mentioned"]
}

Classification rules:
- "inbound_license": ONS is acquiring/licensing broadcast rights FROM a distributor
- "amendment": Modification to an existing contract (extension, fee change, additional titles)
- "outbound": ONS is licensing or sublicensing rights TO another party
- "invoice": A payment invoice, not a license agreement
- "issue": Cannot determine type, or contract is incomplete/missing appendix

${!isPdf ? `Document content:\n\n${extractedText}` : ""}`;

    const phase1Content: any[] = [classifyPrompt];
    if (isPdf) phase1Content.push({ inlineData: { data: fileBuffer.toString("base64"), mimeType } });

    const phase1Result = await model.generateContent(phase1Content);
    const classification = parseAiJson(phase1Result.response.text());

    // If not ingestible, return early
    if (classification.classification !== "inbound_license" && classification.classification !== "amendment") {
      return {
        classification: classification.classification,
        contractName: classification.contractName || "Unknown Contract",
        distributor: classification.distributor || "Unknown",
        totalFee: classification.totalFee,
        currency: classification.currency || "EUR",
        notes: classification.notes || "",
        contractMode: null,
        licenses: [],
        warnings: [`Contract classified as "${classification.classification}" — not ingested as inbound rights.`],
        rawExtraction: classification,
      };
    }

    // Phase 2: Search for existing licenses and series
    const allLicenses = await storage.listLicenses();
    const candidates = allLicenses.filter(l => {
      const distMatch = l.distributor?.toLowerCase().includes(classification.distributor?.toLowerCase() || "");
      const titleMatch = (classification.titles || []).some((t: string) =>
        l.name.toLowerCase().includes(t.toLowerCase()) ||
        l.contentTitle?.toLowerCase().includes(t.toLowerCase())
      );
      return distMatch || titleMatch;
    }).slice(0, 20);

    const allSeries = await storage.getAllSeries();
    const seriesCandidates = allSeries.filter(s =>
      (classification.titles || []).some((t: string) =>
        s.title.toLowerCase().includes(t.toLowerCase()) ||
        t.toLowerCase().includes(s.title.toLowerCase())
      )
    ).slice(0, 20);

    // Phase 3: Full extraction with detailed license derivation
    const fullPrompt = `Role: Expert Legal Content Analyst for broadcast television company ONS.
Task: Extract detailed license structure from this contract and compare against existing database records to prevent duplicates.

EXISTING LICENSE CANDIDATES (for deduplication):
${JSON.stringify(candidates.map(c => ({
  id: c.id, name: c.name, distributor: c.distributor, contentTitle: c.contentTitle,
  season: c.season, licenseFeeAmount: c.licenseFeeAmount,
  licenseStart: c.licenseStart, licenseEnd: c.licenseEnd, allowedRuns: c.allowedRuns,
})), null, 2)}

EXISTING SERIES IN DATABASE:
${JSON.stringify(seriesCandidates.map(s => ({ id: s.id, title: s.title })), null, 2)}

CRITICAL BUSINESS RULES:

1. CONTRACT MODE DETECTION:
   - "umbrella": ALL titles share the EXACT same material terms (same start/end dates, same runs, one flat fee). Create ONE license.
   - "split": Different titles have DIFFERENT terms (different dates, different fees, different runs). Create SEPARATE licenses per title/block.
   - "mixed": Some titles share terms but at least one block differs. Group shared titles, separate differing ones.

2. LICENSE NAMING:
   - Use PLAIN content names only. Example: "Dr. Quinn Medicine Woman", NOT "Dr. Quinn Medicine Woman (Season 1)".
   - Store season info in the "season" field, NOT in the name.
   - Keep names simple: "Ballykissangel", not "BBC - Ballykissangel License Agreement".

3. RUNS & FEES:
   - If contract says "unlimited" / "onbeperkt" / "no limit", set allowedRuns to null and note in notes field.
   - licenseFeeAmount must be a number string (e.g. "8375.00"). If one fee covers multiple titles, divide proportionally OR keep on the umbrella license.
   - licenseFeePaid: set to 1 if this is a signed/executed contract with confirmed fees.

4. DEDUPLICATION:
   - If a CANDIDATE matches by name + distributor + overlapping dates, propose action "update" with the candidate's ID.
   - If dates are significantly different (new term), propose "create" even if name matches.

5. CONTENT ITEMS:
   - For each license, list the content items: { title, season, episodes }
   - If season is 0 or missing, set to 1.
   - episodes: number of episodes if known, 0 if unknown.

6. SERIES MATCHING:
   - For each content title, check if it matches an EXISTING SERIES by title.
   - If matched, include seriesId. If not matched, set seriesId to null (we'll create it).

Return ONLY this JSON:
{
  "contractMode": "umbrella" | "split" | "mixed",
  "sharedTerms": {
    "territory": "string or null",
    "rights": "string or null",
    "exclusivity": "string or null"
  },
  "licenses": [
    {
      "action": "create" | "update",
      "existingLicenseId": "string or null (ID from candidates if updating)",
      "explanation": "why create or update",
      "name": "plain content name",
      "distributor": "normalized short name",
      "contentTitle": "same as name",
      "season": "string (e.g. '1' or '1, 2, 3')",
      "licenseFeeAmount": "string number",
      "licenseFeeCurrency": "EUR|USD|GBP",
      "licenseFeePaid": 0 | 1,
      "licenseStart": "YYYY-MM-DD or null",
      "licenseEnd": "YYYY-MM-DD or null",
      "allowedRuns": "string number or null for unlimited",
      "productionYear": "number or null",
      "subsFromDistributor": 0 | 1,
      "description": "string or null",
      "notes": "legal context, exceptions, unlimited runs note, etc.",
      "contentItems": [
        {
          "title": "string",
          "season": number,
          "episodes": number,
          "matchedSeriesId": "string or null"
        }
      ]
    }
  ],
  "paymentTerms": [
    {
      "year": number,
      "amountCents": integer — "the fee in CENTS for this specific year (e.g. 1000000 = €10,000.00)",
      "currency": "EUR|USD|GBP",
      "dueDate": "YYYY-MM-DD or null",
      "notes": "e.g. 'year 1 of 3', 'on signing', 'Q2 installment'"
    }
  ],
  "warnings": ["array of any issues, ambiguities, or missing information"]
}

PAYMENT TERMS RULES:
- Payment terms are at CONTRACT level, NOT per-license. Extract the total contract payment schedule.
- If the contract specifies a payment schedule (e.g. split over multiple years, installments), extract each installment as a separate paymentTerms entry.
- If there is only one lump-sum fee with no yearly breakdown, create a single paymentTerms entry for the year the contract starts.
- The "year" field is the calendar/fiscal year (e.g. 2025, 2026).
- The "amountCents" field is an INTEGER in cents. €10,000.00 = 1000000. €8,375.50 = 837550.
- If the contract says "€30,000 over 3 years (2025-2027)", create 3 entries: {year: 2025, amountCents: 1000000}, {year: 2026, amountCents: 1000000}, {year: 2027, amountCents: 1000000}.
- Do NOT duplicate the fee across licenses. One contract = one set of payment terms.
- Only extract payment terms that are explicitly stated or clearly derivable from the contract. Do not guess.

${!isPdf ? `Document content:\n\n${extractedText}` : ""}

Only return the JSON object. No markdown formatting.`;

    const fullContent: any[] = [fullPrompt];
    if (isPdf) fullContent.push({ inlineData: { data: fileBuffer.toString("base64"), mimeType } });

    const fullResult = await model.generateContent(fullContent);
    const extraction = parseAiJson(fullResult.response.text());

    // Normalize
    for (const lic of extraction.licenses || []) {
      if (lic.contentItems) {
        for (const item of lic.contentItems) {
          if (!item.season || item.season === 0) item.season = 1;
        }
      }
      // Normalize season field
      if (lic.season === "0" || !lic.season) lic.season = "1";
    }

    return {
      classification: classification.classification,
      contractName: classification.contractName || "Unknown Contract",
      distributor: classification.distributor || "Unknown",
      totalFee: classification.totalFee,
      currency: classification.currency || "EUR",
      notes: classification.notes || "",
      contractMode: extraction.contractMode || null,
      sharedTerms: extraction.sharedTerms || null,
      licenses: extraction.licenses || [],
      paymentTerms: extraction.paymentTerms || [],
      warnings: [
        ...(extraction.warnings || []),
      ],
      rawExtraction: { classification, extraction },
    };
  }

  async generateText(prompt: string): Promise<string> {
    await this.initialize();
    if (!this.genAI) throw new Error("AI not initialized");

    const model = this.genAI.getGenerativeModel({ model: this.model });
    const result = await model.generateContent(prompt);
    return result.response.text();
  }
}

export const aiService = new AiService();
