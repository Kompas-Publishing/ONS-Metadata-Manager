import { GoogleGenerativeAI } from "@google/generative-ai";
import { extname } from "path";
import * as XLSX from "xlsx";
import mammoth from "mammoth";
import { storage } from "./storage.js";
import type { UserPermissions } from "./permissions.js";
import {
  insertMetadataFileSchema,
  insertLicenseSchema,
  insertTaskSchema
} from "./schema.js";

export type ChatMessage = {
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  tool_call_id?: string;
  name?: string;
};

export type ChatAttachment = {
  fileName: string;
  mimeType?: string;
  buffer: Buffer;
};

export type ChatProposal = {
  type: "metadata" | "license" | "task";
  action: "create" | "update";
  data: Record<string, any>;
  id?: string;
  explanation?: string;
};

export type ChatSource = {
  title?: string;
  url?: string;
  query?: string;
};

const MAX_CHAT_FILE_SIZE = 100 * 1024 * 1024; // 100MB
const MAX_ATTACHMENT_TEXT_CHARS = 200_000;

const CHAT_ALLOWED_EXTENSIONS = new Set([
  ".pdf",
  ".docx",
  ".rtf",
  ".txt",
  ".csv",
  ".tsv",
  ".xlsx",
  ".xls",
  ".json",
  ".yaml",
  ".yml",
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".bmp",
  ".tif",
  ".tiff",
]);

const CHAT_ALLOWED_MIME_TYPES = new Set([
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
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/bmp",
  "image/tiff",
]);

const EXTENSION_MIME_MAP: Record<string, string> = {
  ".pdf": "application/pdf",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".rtf": "application/rtf",
  ".txt": "text/plain",
  ".csv": "text/csv",
  ".tsv": "text/tab-separated-values",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".xls": "application/vnd.ms-excel",
  ".json": "application/json",
  ".yaml": "application/x-yaml",
  ".yml": "application/x-yaml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".bmp": "image/bmp",
  ".tif": "image/tiff",
  ".tiff": "image/tiff",
};

function resolveMimeType(fileName: string, mimeType?: string) {
  const ext = extname(fileName).toLowerCase();
  if (mimeType && mimeType !== "application/octet-stream") {
    return mimeType;
  }
  return EXTENSION_MIME_MAP[ext] || mimeType || "application/octet-stream";
}

function assertAllowedChatAttachment(fileName: string, mimeType?: string) {
  const ext = extname(fileName).toLowerCase();
  const resolvedMime = resolveMimeType(fileName, mimeType);
  const allowed = CHAT_ALLOWED_EXTENSIONS.has(ext) || CHAT_ALLOWED_MIME_TYPES.has(resolvedMime);
  if (!allowed) {
    throw new Error("Unsupported file type. Please upload documents, spreadsheets, PDFs, images, JSON, or YAML files.");
  }
  return resolvedMime;
}

async function extractTextFromBuffer(fileBuffer: Buffer, mimeType: string): Promise<string> {
  if (
    mimeType.startsWith("text/") ||
    mimeType === "application/json" ||
    mimeType === "text/json" ||
    mimeType === "application/x-yaml" ||
    mimeType === "text/yaml" ||
    mimeType === "text/x-yaml" ||
    mimeType === "application/yaml"
  ) {
    return fileBuffer.toString("utf-8");
  }

  if (
    mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    mimeType === "application/vnd.ms-excel"
  ) {
    const workbook = XLSX.read(fileBuffer, { type: "buffer" });
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    return XLSX.utils.sheet_to_csv(worksheet);
  }

  if (mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
    const result = await mammoth.extractRawText({ buffer: fileBuffer });
    return result.value;
  }

  if (mimeType === "application/rtf") {
    return fileBuffer.toString("utf-8");
  }

  return fileBuffer.toString("utf-8");
}

async function buildAttachmentParts(attachment: ChatAttachment) {
  if (attachment.buffer.length > MAX_CHAT_FILE_SIZE) {
    throw new Error("File too large. Max file size is 100MB.");
  }

  const resolvedMime = assertAllowedChatAttachment(attachment.fileName, attachment.mimeType);
  const ext = extname(attachment.fileName).toLowerCase();
  const isPdf = resolvedMime === "application/pdf" || ext === ".pdf";
  const isImage = resolvedMime.startsWith("image/");

  if (isPdf || isImage) {
    return [
      { text: `Attachment: ${attachment.fileName}` },
      { inlineData: { data: attachment.buffer.toString("base64"), mimeType: resolvedMime } },
    ];
  }

  const extractedText = await extractTextFromBuffer(attachment.buffer, resolvedMime);
  const trimmedText =
    extractedText.length > MAX_ATTACHMENT_TEXT_CHARS
      ? `${extractedText.slice(0, MAX_ATTACHMENT_TEXT_CHARS)}\n\n[Truncated]`
      : extractedText;

  return [{ text: `Attachment: ${attachment.fileName}\n\n${trimmedText}` }];
}

/**
 * Helper to normalize metadata fields before database operations.
 */
function normalizeMetadataData(data: Record<string, any>): Record<string, any> {
  const normalized = { ...data };

  // Fields that MUST be arrays in the database
  const arrayFields = ['genre', 'actors', 'tags', 'breakTimes'];

  for (const field of arrayFields) {
    if (normalized[field] !== undefined && normalized[field] !== null) {
      if (typeof normalized[field] === 'string') {
        normalized[field] = normalized[field].split(',').map((s: string) => s.trim()).filter(Boolean);
      } else if (!Array.isArray(normalized[field])) {
        normalized[field] = [normalized[field].toString()];
      }
    }
  }

  // Common AI misnamings mapped to schema keys
  const mapping: Record<string, string> = {
    'series title': 'seriesTitle',
    'Series Title': 'seriesTitle',
    'production country': 'productionCountry',
    'Production Country': 'productionCountry',
    'year of production': 'yearOfProduction',
    'Year of Production': 'yearOfProduction',
    'episode title': 'episodeTitle',
    'Episode Title': 'episodeTitle',
    'episode description': 'episodeDescription',
    'Episode Description': 'episodeDescription',
    'original filename': 'originalFilename',
    'Original Filename': 'originalFilename'
  };

  for (const [badKey, goodKey] of Object.entries(mapping)) {
    if (normalized[badKey] !== undefined && normalized[goodKey] === undefined) {
      normalized[goodKey] = normalized[badKey];
      delete normalized[badKey];
    }
  }

  return normalized;
}

const DEFAULT_CHAT_MODEL = "gemini-3-pro-preview";

async function getModel(systemPrompt: string, modelOverride?: string) {
  const apiKey = (await storage.getSetting("ai_api_key"))?.value;
  const configuredModel = (await storage.getSetting("ai_model"))?.value;

  if (!apiKey) {
    throw new Error("AI not configured. Please set the Gemini API key in the Admin panel.");
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  // Use the configured model or fallback
  const modelName = modelOverride || configuredModel || DEFAULT_CHAT_MODEL;

  const tools: any[] = [
    {
      functionDeclarations: [
        {
          name: "searchWeb",
          description: "Search the public web for up-to-date information and return sources.",
          parameters: {
            type: "OBJECT",
            properties: {
              query: { type: "STRING", description: "Search query." }
            },
            required: ["query"]
          }
        },
        {
          name: "searchMetadata",
          description: "Search the metadata database for files by keyword. Only returns data if user has read permissions.",
          parameters: {
            type: "OBJECT",
            properties: {
              query: { type: "STRING", description: "The keyword to search for (e.g. series title, episode title)" }
            },
            required: ["query"]
          }
        },
        {
          name: "searchLicenses",
          description: "Search the license database for contracts by keyword. Only returns data if user has read permissions.",
          parameters: {
            type: "OBJECT",
            properties: {
              query: { type: "STRING", description: "The keyword to search for (e.g. distributor name, contract title)" }
            },
            required: ["query"]
          }
        },
        {
          name: "proposeMetadataChange",
          description: "Propose a creation or update to a metadata file. The user must approve this change. Only works if user has write permissions.",
          parameters: {
            type: "OBJECT",
            properties: {
              action: { type: "STRING", enum: ["create", "update"] },
              id: { type: "STRING", description: "The ID of the file to update (required for action='update')" },
              data: {
                type: "OBJECT",
                description: "The metadata fields to set. Use database field names like 'title', 'season', 'episode', 'duration', 'description', 'genre', 'actors', 'yearOfProduction', etc."
              },
              explanation: { type: "STRING", description: "Explain why you are proposing this change (e.g. 'Found missing duration on IMDb')" }
            },
            required: ["action", "data", "explanation"]
          }
        },
        {
          name: "proposeLicenseChange",
          description: "Propose a creation or update to a license. The user must approve this change. Only works if user has write permissions.",
          parameters: {
            type: "OBJECT",
            properties: {
              action: { type: "STRING", enum: ["create", "update"] },
              id: { type: "STRING", description: "The ID of the license to update (required for action='update')" },
              data: {
                type: "OBJECT",
                description: "The license fields to set. Use database field names like 'name', 'distributor', 'licenseStart', 'licenseEnd', 'allowedRuns', etc."
              },
              explanation: { type: "STRING", description: "Explain why you are proposing this change." }
            },
            required: ["action", "data", "explanation"]
          }
        }
      ]
    }
  ];

  return genAI.getGenerativeModel({
    model: modelName,
    systemInstruction: systemPrompt,
    tools,
  });
}

function extractSearchSources(response: any) {
  const sources: { title?: string; url?: string }[] = [];
  const grounding = response?.candidates?.[0]?.groundingMetadata;
  const chunks = grounding?.groundingChunks || [];
  for (const chunk of chunks) {
    const web = chunk?.web || chunk?.document || {};
    const url = web?.uri || web?.url || chunk?.uri || chunk?.url;
    const title = web?.title || chunk?.title;
    if (url) {
      sources.push({ title, url });
    }
  }
  const deduped = new Map<string, { title?: string; url?: string }>();
  for (const source of sources) {
    if (source.url && !deduped.has(source.url)) {
      deduped.set(source.url, source);
    }
  }
  return Array.from(deduped.values()).slice(0, 8);
}

async function runWebSearch(query: string) {
  const apiKey = (await storage.getSetting("ai_api_key"))?.value;
  const configuredModel = (await storage.getSetting("ai_model"))?.value;
  if (!apiKey) {
    throw new Error("AI not configured. Please set the Gemini API key in the Admin panel.");
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const searchModelName =
    configuredModel && configuredModel.startsWith("gemini-3")
      ? configuredModel
      : DEFAULT_CHAT_MODEL;

  const searchModel = genAI.getGenerativeModel({
    model: searchModelName,
    tools: [{ google_search: {} } as any],
  });

  const prompt = `Search the web for: ${query}\nReturn a concise factual summary with sources.`;
  const result = await searchModel.generateContent(prompt);
  const response = result.response;
  let summary = "";
  try {
    summary = response.text();
  } catch (error) {
    summary = "";
  }

  return {
    query,
    summary: summary || "No summary returned.",
    sources: extractSearchSources(response),
    model: searchModelName,
  };
}

function isToolUnsupportedError(error: any) {
  const message = typeof error?.message === "string" ? error.message : "";
  return message.includes("Tool use with function calling is unsupported by the model");
}

/**
 * AI Chat runner.
 */
export async function runAiChat(
  messages: ChatMessage[],
  permissions: UserPermissions,
  options?: { debug?: boolean; attachment?: ChatAttachment }
) {
  const systemPrompt = `You are the ONS Broadcast Portal Assistant.
You help users manage metadata, licenses, and tasks.
You have access to tools to search the database and propose changes.

PERMISSION RULES:
- Metadata Read: ${permissions.features.metadata.read ? "ALLOWED" : "DENIED"}
- Metadata Write: ${permissions.features.metadata.write ? "ALLOWED" : "DENIED"}
- License Read: ${permissions.features.licenses.read ? "ALLOWED" : "DENIED"}
- License Write: ${permissions.features.licenses.write ? "ALLOWED" : "DENIED"}

LANGUAGE RULES:
- IMPORTANT: All descriptions (description, episodeDescription) MUST be in Dutch (Nederlands).
- Other fields like titles should remain in their original language (usually German or English) unless instructed otherwise.
- CONVERSATION: Speak to the user in the SAME LANGUAGE they use to address you. If they speak English, you reply in English. If they speak Dutch, you reply in Dutch.

DATA TYPE RULES:
- IMPORTANT: The following fields MUST be arrays of strings: 'genre', 'actors', 'tags', 'breakTimes'.
- Use EXACT database field names: 'seriesTitle', 'productionCountry', 'yearOfProduction', 'episodeTitle', 'episodeDescription'.

TOOL USAGE RULES:
- If a user asks to "fix", "update", "add", or "change" something, YOU MUST USE THE PROPOSAL TOOLS.
- DO NOT just say "I have updated it" or "I will do it". You MUST call the 'proposeMetadataChange' or 'proposeLicenseChange' tool for EACH item you intend to change.
- If updating multiple episodes, call the tool multiple times (once for each episode).
- After calling a tool, summarize what you've done and inform the user you have created a proposal for them to review.
- If you cannot find information on IMDb or elsewhere, tell the user exactly what you searched for.
- If the user asks for up-to-date information or anything outside the database, use the 'searchWeb' tool and reference its sources.

GENERAL RULES:
- IMPORTANT: You MUST generate a text response AFTER calling tools. Never leave the final response blank.
- If a user asks for something they don't have permission for, politely explain that you cannot access that information.
- When searching, if no results are found, you can offer to perform a general knowledge search or suggest corrections.
- If you find missing information (like on IMDb via your internal knowledge), use the 'proposeMetadataChange' or 'proposeLicenseChange' tools.
- Changes are NOT applied automatically; they are shown to the user as proposals to accept or reject.
- ALWAYS provide a text response explaining what you found or what you proposed. NEVER return an empty message.

Always be professional and helpful.`;

  let model = await getModel(systemPrompt);

  // Filter out any system messages from the history
  const chatHistory = messages
    .filter(m => m.role !== "system" && m.role !== "tool")
    .map(m => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content || " " }] // Ensure content is never empty
    }));

  const buildChat = (chatModel: any) =>
    chatModel.startChat({
      history: chatHistory,
      generationConfig: {
        maxOutputTokens: 4096,
      }
    });

  let chat = buildChat(model);

  let currentPrompt = messages[messages.length - 1].content;
  if (messages[messages.length - 1].role !== "user") {
    return { message: "Last message was not from user." };
  }

  const promptText = currentPrompt?.trim()
    ? currentPrompt
    : options?.attachment
      ? "Please analyze the attached file."
      : " ";

  const promptParts: any[] = [{ text: promptText }];
  if (options?.attachment) {
    const attachmentParts = await buildAttachmentParts(options.attachment);
    promptParts.push(...attachmentParts);
  }

  let response;
  try {
    response = await chat.sendMessage(promptParts);
  } catch (error: any) {
    if (isToolUnsupportedError(error)) {
      console.warn("Configured model does not support tool use. Falling back to Gemini 3 Pro preview.");
      model = await getModel(systemPrompt, DEFAULT_CHAT_MODEL);
      chat = buildChat(model);
      response = await chat.sendMessage(promptParts);
    } else {
      throw error;
    }
  }
  const proposals: ChatProposal[] = [];
  const debugLogs: any[] = [];
  const searchSources: ChatSource[] = [];

  // Handle function calls in a loop to allow multiple steps
  let functionCalls = response.response.functionCalls();

  while (functionCalls && functionCalls.length > 0) {
    const toolResults: any[] = [];

    for (const call of functionCalls) {
      if (options?.debug) {
        debugLogs.push({ type: "tool_call", name: call.name, args: call.args });
      }

      let result: any;
      try {
        switch (call.name) {
          case "searchWeb":
            if (!call.args?.query) {
              result = { error: "Missing query." };
            } else {
              result = await runWebSearch(call.args.query as string);
              if (Array.isArray(result?.sources)) {
                for (const source of result.sources) {
                  searchSources.push({
                    title: source.title,
                    url: source.url,
                    query: result.query,
                  });
                }
              }
            }
            break;
          case "searchMetadata":
            if (!permissions.features.metadata.read) {
              result = { error: "Permission denied: Cannot read metadata." };
            } else {
              result = await storage.searchMetadata(call.args.query as string, permissions);
            }
            break;

          case "searchLicenses":
            if (!permissions.features.licenses.read) {
              result = { error: "Permission denied: Cannot read licenses." };
            } else {
              result = await storage.searchLicenses(call.args.query as string);
            }
            break;

          case "proposeMetadataChange":
            if (!permissions.features.metadata.write) {
              result = { error: "Permission denied: Cannot write metadata." };
            } else {
              proposals.push({
                type: "metadata",
                action: call.args.action as "create" | "update",
                id: call.args.id as string,
                data: call.args.data as Record<string, any>,
                explanation: call.args.explanation as string
              });
              result = { status: "Proposal recorded. Inform the user." };
            }
            break;

          case "proposeLicenseChange":
            if (!permissions.features.licenses.write) {
              result = { error: "Permission denied: Cannot write licenses." };
            } else {
              proposals.push({
                type: "license",
                action: call.args.action as "create" | "update",
                id: call.args.id as string,
                data: call.args.data as Record<string, any>,
                explanation: call.args.explanation as string
              });
              result = { status: "Proposal recorded. Inform the user." };
            }
            break;

          default:
            result = { error: "Unknown tool." };
        }
      } catch (err: any) {
        result = { error: err.message };
      }

      if (options?.debug) {
        debugLogs.push({ type: "tool_result", name: call.name, result });
      }

      toolResults.push({
        functionResponse: {
          name: call.name,
          response: { result }
        }
      });
    }

    // Send tool results back to the model
    response = await chat.sendMessage(toolResults);
    // Check if there are more function calls in the new response
    functionCalls = response.response.functionCalls();
  }

  let responseText = "";
  try {
    responseText = response.response.text();
  } catch (e) {
    // text() might throw if there are no text parts
  }

  if (!responseText || responseText.trim() === "") {
    if (proposals.length > 0) {
      responseText = `I have generated ${proposals.length} proposal${proposals.length > 1 ? "s" : ""} for you to review and accept. These include updates for: ${proposals.map(p => p.data.title || p.data.seriesTitle || p.type).join(", ")}.`;
    } else if (debugLogs.some(log => log.type === 'tool_call')) {
      const toolNames = Array.from(new Set(debugLogs.filter(d => d.type === "tool_call").map(d => d.name)));
      responseText = `I've performed a search via the ${toolNames.join(", ")} tool(s) but didn't find specific changes to propose. You can view the search results to see what I found.`;
    } else {
      responseText = "I've analyzed your request. Please clarify what information you'd like me to find or change, and I will do my best to assist.";
    }
  }

  return {
    message: responseText,
    proposals: proposals.length > 0 ? proposals : undefined,
    sources: searchSources.length > 0
      ? Array.from(new Map(searchSources.filter(s => s.url).map(s => [s.url!, s])).values())
      : undefined,
    debug: options?.debug ? debugLogs : undefined
  };
}

/**
 * Execute proposal.
 */
export async function executeChatProposal(
  proposal: ChatProposal,
  permissions: UserPermissions,
  userId: string
) {
  if (proposal.type === "metadata") {
    if (!permissions.features.metadata.write) throw new Error("Permission denied: Cannot write metadata.");

    const normalizedData = normalizeMetadataData(proposal.data);
    const { licenseIds, ...dataWithoutLicenses } = normalizedData as any;

    if (proposal.action === "create") {
      const validation = insertMetadataFileSchema.safeParse(normalizedData);
      if (!validation.success) throw new Error("Validation failed: " + JSON.stringify(validation.error.errors));

      const nextId = await storage.consumeNextId();
      return await storage.createMetadataFile({
        ...validation.data,
        licenseIds: licenseIds || []
      }, nextId, permissions);
    } else {
      if (!proposal.id) throw new Error("ID required for update action.");
      return await storage.updateMetadataFile(proposal.id, {
        ...normalizedData,
        licenseIds: licenseIds
      }, permissions);
    }
  } else if (proposal.type === "license") {
    if (!permissions.features.licenses.write) throw new Error("Permission denied: Cannot write licenses.");

    if (proposal.action === "create") {
      const validation = insertLicenseSchema.safeParse(proposal.data);
      if (!validation.success) throw new Error("Validation failed: " + JSON.stringify(validation.error.errors));
      return await storage.createLicense(validation.data);
    } else {
      if (!proposal.id) throw new Error("ID required for update action.");
      return await storage.updateLicense(proposal.id, proposal.data);
    }
  }

  throw new Error(`Unsupported proposal type: ${proposal.type}`);
}
