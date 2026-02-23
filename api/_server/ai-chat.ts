import { GoogleGenerativeAI } from "@google/generative-ai";
import { storage } from "./storage.js";
import type { UserPermissions } from "../_shared/types.js";
import { 
  insertMetadataFileSchema, 
  insertLicenseSchema, 
  insertTaskSchema 
} from "../_shared/schema.js";

export type ChatMessage = {
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  tool_call_id?: string;
  name?: string;
};

export type ChatProposal = {
  type: "metadata" | "license" | "task";
  action: "create" | "update";
  data: Record<string, any>;
  id?: string;
  explanation?: string;
};

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

async function getModel(systemPrompt: string) {
  const apiKey = (await storage.getSetting("ai_api_key"))?.value;
  const configuredModel = (await storage.getSetting("ai_model"))?.value;

  if (!apiKey) {
    throw new Error("AI not configured. Please set the Gemini API key in the Admin panel.");
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  // Use the configured model or fallback
  const modelName = configuredModel || "gemini-1.5-pro";
  
  return genAI.getGenerativeModel({
    model: modelName,
    systemInstruction: systemPrompt,
    tools: [
      {
        functionDeclarations: [
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
    ]
  });
}

/**
 * AI Chat runner.
 */
export async function runAiChat(
  messages: ChatMessage[],
  permissions: UserPermissions,
  options?: { debug?: boolean }
) {
  const systemPrompt = `You are the ONS Broadcast Portal Assistant. 
You help users manage metadata, licenses, and tasks.
You have access to tools to search the database and propose changes.

PERMISSION RULES:
- Metadata Read: ${permissions.permissions.metadata.read ? "ALLOWED" : "DENIED"}
- Metadata Write: ${permissions.permissions.metadata.write ? "ALLOWED" : "DENIED"}
- License Read: ${permissions.permissions.licenses.read ? "ALLOWED" : "DENIED"}
- License Write: ${permissions.permissions.licenses.write ? "ALLOWED" : "DENIED"}

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

GENERAL RULES:
- IMPORTANT: You MUST generate a text response AFTER calling tools. Never leave the final response blank.
- If a user asks for something they don't have permission for, politely explain that you cannot access that information.
- When searching, if no results are found, you can offer to perform a general knowledge search or suggest corrections.
- If you find missing information (like on IMDb via your internal knowledge), use the 'proposeMetadataChange' or 'proposeLicenseChange' tools. 
- Changes are NOT applied automatically; they are shown to the user as proposals to accept or reject.
- ALWAYS provide a text response explaining what you found or what you proposed. NEVER return an empty message.

Always be professional and helpful.`;

  const model = await getModel(systemPrompt);

  // Filter out any system messages from the history
  const chatHistory = messages
    .filter(m => m.role !== "system" && m.role !== "tool")
    .map(m => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content || " " }] // Ensure content is never empty
    }));

  const chat = model.startChat({
    history: chatHistory,
    generationConfig: {
      maxOutputTokens: 4096,
    }
  });

  let currentPrompt = messages[messages.length - 1].content;
  if (messages[messages.length - 1].role !== "user") {
    return { message: "Last message was not from user." };
  }

  let response = await chat.sendMessage(currentPrompt);
  const proposals: ChatProposal[] = [];
  const debugLogs: any[] = [];

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
          case "searchMetadata":
            if (!permissions.permissions.metadata.read) {
              result = { error: "Permission denied: Cannot read metadata." };
            } else {
              result = await storage.searchMetadata(call.args.query as string, permissions);
            }
            break;
            
          case "searchLicenses":
            if (!permissions.permissions.licenses.read) {
              result = { error: "Permission denied: Cannot read licenses." };
            } else {
              result = await storage.searchLicenses(call.args.query as string);
            }
            break;
            
          case "proposeMetadataChange":
            if (!permissions.permissions.metadata.write) {
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
            if (!permissions.permissions.licenses.write) {
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
    if (!permissions.permissions.metadata.write) throw new Error("Permission denied: Cannot write metadata.");
    
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
    if (!permissions.permissions.licenses.write) throw new Error("Permission denied: Cannot write licenses.");

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
