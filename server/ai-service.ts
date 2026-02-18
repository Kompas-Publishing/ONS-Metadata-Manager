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

  private extractTextFromBuffer(fileBuffer: Buffer, mimeType: string): string {
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
    }
    return "";
  }

  async parseLicenseContract(fileBuffer: Buffer, mimeType: string): Promise<any> {
    await this.initialize();
    if (!this.genAI) throw new Error("AI not initialized");

    const model = this.genAI.getGenerativeModel({ model: this.model });
    const isPdf = mimeType === "application/pdf";
    const extractedText = isPdf ? "" : this.extractTextFromBuffer(fileBuffer, mimeType);

    const prompt = `Role: Expert Legal Content Analyst.

Task: Extract contract data into a structured JSON array of "license" objects.

Granularity Logic:
* If the contract is for a single title/package: Return an array with one license object.
* If the contract contains multiple titles, seasons, or packages with different dates or fees (e.g., a Schedule A table): Atomize the data. Create a unique license object for every distinct row or content group that has its own financial or timing terms.

Data Rules:
- Name: Use the Content Title and Season (e.g., "Ballykissangel Series 2"). DO NOT include legal headers like "Amendment Agreement", "Deal Memo", or contract numbers in the name itself.
- Fee Calculation: If the contract lists a "Price per Episode," multiply it by the episode count for that specific entry's total amount.
- Missing Fields: Use null for fields not found. Do not guess.
- Distributor Normalization: Use "MGM" instead of "MGM International Television Distribution Inc." and "BBC" instead of its full legal name.

JSON Schema (MATCH EXACT DATABASE FIELDS):
{
  "licenses": [
    {
      "name": "string",
      "distributor": "string",
      "contentTitle": "string",
      "licenseFeeAmount": "string", (Total amount as numeric string)
      "licenseFeeCurrency": "string", (e.g. "EUR", "USD")
      "licenseStart": "YYYY-MM-DD",
      "licenseEnd": "YYYY-MM-DD",
      "allowed_runs": "string",
      "description": "string",
      "notes": "string", (Include legal headers or specific contract context here, e.g. "Amendment Agreement No.2")
      "content_items": [{ "title": "string", "episodes": number }]
    }
  ]
}

${!isPdf ? `The document content is as follows:\n\n${extractedText}` : ""}

Only return the JSON object. Do not include markdown formatting or extra text.`;

    const content: any[] = [prompt];
    if (isPdf) {
      content.push({
        inlineData: {
          data: fileBuffer.toString("base64"),
          mimeType: mimeType
        }
      });
    }

    const result = await model.generateContent(content);
    const response = await result.response;
    const text = response.text();
    
    try {
      const jsonStr = text.replace(/```json|```/g, "").trim();
      return JSON.parse(jsonStr);
    } catch (e) {
      console.error("Failed to parse AI response:", text);
      throw new Error("AI returned invalid JSON. Please try again.");
    }
  }

  async parseMetadataDocument(fileBuffer: Buffer, mimeType: string, permissions: UserPermissions): Promise<any> {
    await this.initialize();
    if (!this.genAI) throw new Error("AI not initialized");

    const model = this.genAI.getGenerativeModel({ model: this.model });
    const isPdf = mimeType === "application/pdf";
    const extractedText = isPdf ? "" : this.extractTextFromBuffer(fileBuffer, mimeType);

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

    // Enrich proposals with existingData for UI comparison
    for (const proposal of resultJson.proposals || []) {
      if (proposal.action === "update" && proposal.data.id) {
        proposal.existingData = uniqueCandidates.find(c => c.id === proposal.data.id);
      }
    }

    return resultJson;
  }
}

export const aiService = new AiService();
