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
    this.model = configuredModel || "gemini-1.5-pro";
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

    const prompt = `Task: Extract video metadata from this document.
Return a JSON array of metadata objects.

JSON Schema:
{
  "items": [
    {
      "title": "string",
      "series_title": "string",
      "season": number,
      "episode": number,
      "episode_title": "string",
      "duration": "HH:MM:SS",
      "description": "string",
      "genre": ["string"],
      "actors": ["string"],
      "production_country": "string",
      "year_of_production": number
    }
  ]
}

${!isPdf ? `The document content is as follows:\n\n${extractedText}` : ""}

Only return the JSON object.`;

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
    const extractedData = JSON.parse(response.text().replace(/```json|```/g, "").trim());

    const proposals = [];
    const allFiles = await storage.getAllMetadataFiles(permissions);
    
    for (const item of extractedData.items || []) {
      let existingFile: MetadataFile | undefined;
      
      if (item.series_title && item.season && item.episode) {
        existingFile = allFiles.find(f => 
          f.seriesTitle === item.series_title && 
          f.season === item.season && 
          f.episode === item.episode
        );
      } else if (item.title) {
        existingFile = allFiles.find(f => f.title === item.title);
      }

      if (existingFile) {
        proposals.push({
          type: "metadata",
          action: "update",
          data: { ...item, id: existingFile.id },
          existingData: existingFile,
          explanation: `Found matching metadata for "${item.title || item.series_title}" Season ${item.season} Ep ${item.episode}. Proposing update with new information from document.`
        });
      } else {
        proposals.push({
          type: "metadata",
          action: "create",
          data: item,
          explanation: `No matching file found for "${item.title || item.series_title}". Proposing to create a new metadata entry.`
        });
      }
    }

    return { proposals };
  }
}

export const aiService = new AiService();
