import { GoogleGenerativeAI } from "@google/generative-ai";
import { storage } from "./storage";
import { 
  type InsertLicense, 
  type InsertMetadataFile,
  type License,
  type MetadataFile 
} from "@shared/schema";
import { UserPermissions } from "./permissions";
import * as XLSX from "xlsx";
import mammoth from "mammoth";

export class AiService {
  private genAI: GoogleGenerativeAI | null = null;
  private model: string = "gemini-3-pro-preview";

  private async initialize() {
    const apiKey = (await storage.getSetting("ai_api_key"))?.value;
    const provider = (await storage.getSetting("ai_provider"))?.value;
    const configuredModel = (await storage.getSetting("ai_model"))?.value;

    if (!apiKey || provider !== "google") {
      throw new Error("AI not configured. Please set the Gemini API key in the Admin panel.");
    }

    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = configuredModel || "gemini-3-pro-preview";
  }

  private async extractTextFromBuffer(fileBuffer: Buffer, mimeType: string): Promise<string> {
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
    const searchData = JSON.parse(phase1Result.response.text().replace(/```json|```/g, "").trim());
    
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
    const resultJson = JSON.parse(finalResult.response.text().replace(/```json|```/g, "").trim());

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
    const resultJson = JSON.parse(result.response.text().replace(/```json|```/g, "").trim());

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
    const keywordsData = JSON.parse(phase1Result.response.text().replace(/```json|```/g, "").trim());
    
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
    const resultJson = JSON.parse(finalResult.response.text().replace(/```json|```/g, "").trim());

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

  async generateText(prompt: string): Promise<string> {
    await this.initialize();
    if (!this.genAI) throw new Error("AI not initialized");

    const model = this.genAI.getGenerativeModel({ model: this.model });
    const result = await model.generateContent(prompt);
    return result.response.text();
  }
}

export const aiService = new AiService();
