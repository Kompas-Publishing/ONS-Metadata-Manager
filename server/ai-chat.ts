import { GoogleGenerativeAI } from "@google/generative-ai";
import { storage } from "./storage";
import type { UserPermissions } from "./permissions";
import { 
  insertMetadataFileSchema, 
  insertLicenseSchema, 
  insertTaskSchema 
} from "@shared/schema";

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

async function getModel() {
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
  const model = await getModel();

  const systemPrompt = `You are the ONS Broadcast Portal Assistant. 
You help users manage metadata, licenses, and tasks.
You have access to tools to search the database and propose changes.

PERMISSION RULES:
- Metadata Read: ${permissions.permissions.metadata.read ? "ALLOWED" : "DENIED"}
- Metadata Write: ${permissions.permissions.metadata.write ? "ALLOWED" : "DENIED"}
- License Read: ${permissions.permissions.licenses.read ? "ALLOWED" : "DENIED"}
- License Write: ${permissions.permissions.licenses.write ? "ALLOWED" : "DENIED"}

If a user asks for something they don't have permission for, politely explain that you cannot access that information.
When searching, if no results are found, you can offer to perform a general knowledge search or suggest corrections.
If you find missing information (like on IMDb via your internal knowledge), use the 'proposeMetadataChange' or 'proposeLicenseChange' tools. 
Changes are NOT applied automatically; they are shown to the user as proposals to accept or reject.

Always be professional and helpful.`;

  // Filter out any system messages from the history and add our fresh one
  const chatHistory = messages
    .filter(m => m.role !== "system" && m.role !== "tool")
    .map(m => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }]
    }));

  const chat = model.startChat({
    history: chatHistory,
    generationConfig: {
      maxOutputTokens: 2048,
    }
  });

  // Since Gemini SDK handles the multi-turn conversation with tools a bit differently, 
  // we'll use a loop to handle potential tool calls.
  
  let currentPrompt = messages[messages.length - 1].content;
  if (messages[messages.length - 1].role !== "user") {
    // This shouldn't happen with the current route logic, but for safety:
    return { message: "Last message was not from user." };
  }

  let response = await chat.sendMessage(currentPrompt);
  let responseText = "";
  let proposal: ChatProposal | null = null;

  // Handle function calls
  const functionCalls = response.response.functionCalls();
  if (functionCalls && functionCalls.length > 0) {
    const toolResults: any[] = [];
    
    for (const call of functionCalls) {
      if (options?.debug) console.log(`[AI Chat] Tool Call: ${call.name}`, call.args);
      
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
              proposal = {
                type: "metadata",
                action: call.args.action as "create" | "update",
                id: call.args.id as string,
                data: call.args.data as Record<string, any>,
                explanation: call.args.explanation as string
              };
              result = { status: "Proposal created. Awaiting user approval." };
            }
            break;

          case "proposeLicenseChange":
            if (!permissions.permissions.licenses.write) {
              result = { error: "Permission denied: Cannot write licenses." };
            } else {
              proposal = {
                type: "license",
                action: call.args.action as "create" | "update",
                id: call.args.id as string,
                data: call.args.data as Record<string, any>,
                explanation: call.args.explanation as string
              };
              result = { status: "Proposal created. Awaiting user approval." };
            }
            break;
            
          default:
            result = { error: "Unknown tool." };
        }
      } catch (err: any) {
        result = { error: err.message };
      }

      toolResults.push({
        functionResponse: {
          name: call.name,
          response: { result }
        }
      });
    }

    // Send tool results back to get final response
    const finalResponse = await chat.sendMessage(toolResults);
    responseText = finalResponse.response.text();
  } else {
    responseText = response.response.text();
  }

  return {
    message: responseText,
    proposal: proposal || undefined
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
    
    if (proposal.action === "create") {
      const validation = insertMetadataFileSchema.safeParse(proposal.data);
      if (!validation.success) throw new Error("Validation failed: " + JSON.stringify(validation.error.errors));
      
      const nextId = await storage.consumeNextId();
      return await storage.createMetadataFile(validation.data, nextId, permissions);
    } else {
      if (!proposal.id) throw new Error("ID required for update action.");
      return await storage.updateMetadataFile(proposal.id, proposal.data, permissions);
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
