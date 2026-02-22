import type { UserPermissions } from "./permissions";

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export type ChatProposal = {
  type: "metadata" | "license" | "task";
  action: "create" | "update";
  data: Record<string, any>;
  explanation?: string;
};

/**
 * AI Chat runner stub. Logic removed; returns a placeholder message.
 */
export async function runAiChat(
  _messages: ChatMessage[],
  _permissions: UserPermissions,
  _options?: { debug?: boolean }
) {
  return { message: "AI Chat is not connected." };
}

/**
 * Execute proposal stub. Logic removed; throws so callers get a clear error.
 */
export async function executeChatProposal(
  _proposal: ChatProposal,
  _permissions: UserPermissions,
  _userId: string
) {
  throw new Error("Execute proposal is not available.");
}
