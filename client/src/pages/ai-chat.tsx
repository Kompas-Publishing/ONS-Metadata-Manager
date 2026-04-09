import { useEffect, useMemo, useState, useRef } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Sparkles, Loader2, Check, X, Info, Paperclip, MessageSquarePlus } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { upload } from "@vercel/blob/client";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

type Message = {
  role: "user" | "assistant";
  content: string;
  proposals?: any[];
  attachments?: { name: string; size: number; mimeType?: string }[];
  sources?: { title?: string; url?: string; query?: string }[];
};

export default function AiChat() {
  const { canUseAIChat } = useAuth();
  const { toast } = useToast();
  const CACHE_KEY = "ons_ai_chat_session";
  const CACHE_EXPIRY_MS = 2 * 60 * 60 * 1000; // 2 hours

  // Load cached messages on mount
  const loadCachedMessages = (): Message[] => {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return [];
      const cached = JSON.parse(raw);
      if (!cached.timestamp || Date.now() - cached.timestamp > CACHE_EXPIRY_MS) {
        localStorage.removeItem(CACHE_KEY);
        return [];
      }
      return cached.messages || [];
    } catch {
      return [];
    }
  };

  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>(loadCachedMessages);
  const [attachment, setAttachment] = useState<File | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [hasCachedSession, setHasCachedSession] = useState(() => loadCachedMessages().length > 0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Persist messages to localStorage whenever they change
  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ messages, timestamp: Date.now() }));
      setHasCachedSession(true);
    }
  }, [messages]);

  const handleNewChat = () => {
    setMessages([]);
    setInput("");
    setAttachment(null);
    localStorage.removeItem(CACHE_KEY);
    setHasCachedSession(false);
  };

  useEffect(() => {
    document.title = "AI Chat | ONS Broadcast Portal";
  }, []);

  const MAX_FILE_SIZE = 100 * 1024 * 1024;

  const ALLOWED_EXTENSIONS = [
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
    ".md",  
  ];

  const ALLOWED_MIME_TYPES = new Set([
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
    "text/markdown",
  ]);

  const ACCEPTED_FILE_TYPES = ALLOWED_EXTENSIONS.join(",");

  const isAllowedFile = (file: File) => {
    const lowerName = file.name.toLowerCase();
    const ext = lowerName.includes(".") ? lowerName.slice(lowerName.lastIndexOf(".")) : "";
    if (ALLOWED_EXTENSIONS.includes(ext)) return true;
    if (file.type && ALLOWED_MIME_TYPES.has(file.type)) return true;
    return false;
  };

  // Use ResizeObserver to scroll when content height changes (like expanding proposal cards)
  useEffect(() => {
    if (!scrollRef.current) return;
    
    const observer = new ResizeObserver(() => {
      if (scrollRef.current) {
        const scrollArea = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
        if (scrollArea) {
          scrollArea.scrollTop = scrollArea.scrollHeight;
        }
      }
    });

    const scrollContent = scrollRef.current.querySelector('.space-y-6');
    if (scrollContent) {
      observer.observe(scrollContent);
    }

    return () => observer.disconnect();
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;

    if (!isAllowedFile(selected)) {
      toast({
        title: "Unsupported file type",
        description: "Please upload documents, spreadsheets, or images.",
        variant: "destructive",
      });
      e.target.value = "";
      setAttachment(null);
      return;
    }

    if (selected.size > MAX_FILE_SIZE) {
      toast({
        title: "File too large",
        description: "Max file size is 100MB.",
        variant: "destructive",
      });
      e.target.value = "";
      setAttachment(null);
      return;
    }

    setAttachment(selected);
  };

  const handleSend = async () => {
    if (isSending) return;
    const trimmedInput = input.trim();
    if (!trimmedInput && !attachment) return;

    const displayContent = trimmedInput || (attachment ? `Attached file: ${attachment.name}` : "");

    const userMessage: Message = {
      role: "user",
      content: displayContent,
      attachments: attachment
        ? [{ name: attachment.name, size: attachment.size, mimeType: attachment.type }]
        : undefined,
    };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsSending(true);
    const currentAttachment = attachment;
    setAttachment(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }

    try {
      let blobUrl = "";
      if (currentAttachment) {
        const newBlob = await upload(`ai-chat/${currentAttachment.name}`, currentAttachment, {
          access: "private",
          handleUploadUrl: "/api/blob/upload",
          clientPayload: JSON.stringify({ type: "ai-chat" }),
        });
        blobUrl = newBlob.url;
      }

      const response = await apiRequest("POST", "/api/ai/chat", {
        messages: [...messages, userMessage].map((m) => ({
          role: m.role,
          content: m.content,
        })),
        blobUrl: blobUrl || undefined,
        fileName: currentAttachment?.name,
        mimeType: currentAttachment?.type,
        fileSize: currentAttachment?.size,
      });

      const data = await response.json();
      setMessages((prev) => [
        ...prev,
        { 
          role: "assistant", 
          content: data.message, 
          proposals: data.proposals,
          sources: data.sources,
        },
      ]);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to get response from AI.",
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleExecuteProposal = async (proposal: any, messageIndex: number, proposalIndex: number) => {
    setIsExecuting(true);
    try {
      await apiRequest("POST", "/api/ai/chat/execute-proposal", proposal);
      
      toast({
        title: "Success",
        description: "Change applied successfully.",
      });

      // Update message to remove the specific proposal that was applied
      setMessages(prev => prev.map((msg, i) => {
        if (i === messageIndex && msg.proposals) {
          const newProposals = msg.proposals.filter((_, pIdx) => pIdx !== proposalIndex);
          return { ...msg, proposals: newProposals };
        }
        return msg;
      }));

      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ["/api/metadata"] });
      queryClient.invalidateQueries({ queryKey: ["/api/licenses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/contracts"] });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to execute proposal.",
        variant: "destructive",
      });
    } finally {
      setIsExecuting(false);
    }
  };

  const handleExecuteAllProposals = async (messageIndex: number) => {
    const message = messages[messageIndex];
    if (!message || !message.proposals || message.proposals.length === 0) return;

    setIsExecuting(true);
    const proposalsToExecute = [...message.proposals];
    const successfulIndices: number[] = [];
    let errors: string[] = [];

    try {
      // Execute all proposals in this message
      for (let pIdx = 0; pIdx < proposalsToExecute.length; pIdx++) {
        try {
          await apiRequest("POST", "/api/ai/chat/execute-proposal", proposalsToExecute[pIdx]);
          successfulIndices.push(pIdx);
        } catch (err: any) {
          errors.push(err.message || "Unknown error");
        }
      }

      if (successfulIndices.length > 0) {
        toast({
          title: "Batch Success",
          description: `Successfully applied ${successfulIndices.length} change(s).`,
        });

        // Remove only the successfully executed proposals
        setMessages(prev => prev.map((msg, i) => {
          if (i === messageIndex && msg.proposals) {
            const newProposals = msg.proposals.filter((_, pIdx) => !successfulIndices.includes(pIdx));
            return { ...msg, proposals: newProposals };
          }
          return msg;
        }));

        queryClient.invalidateQueries();
      }

      if (errors.length > 0) {
        toast({
          title: "Partial Failure",
          description: `${errors.length} proposal(s) failed to apply.`,
          variant: "destructive",
        });
      }
    } finally {
      setIsExecuting(false);
    }
  };

  const proposalGroups = useMemo(
    () =>
      messages
        .map((message, messageIndex) => ({
          messageIndex,
          proposals: message.proposals || [],
        }))
        .filter((group) => group.proposals.length > 0),
    [messages]
  );

  const proposalCount = useMemo(
    () => proposalGroups.reduce((sum, group) => sum + group.proposals.length, 0),
    [proposalGroups]
  );

  const hasProposals = proposalCount > 0;

  if (!canUseAIChat) {
    return (
      <div className="max-w-4xl mx-auto">
        <Card className="p-12 text-center">
          <p className="text-muted-foreground">You don't have permission to use AI Chat.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4 h-full flex flex-col">
      <div className="shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-5 h-5 text-primary" />
            </div>
            <h1 className="text-2xl font-semibold text-foreground">AI Chat</h1>
          </div>
          {hasCachedSession && (
            <Button variant="outline" size="sm" onClick={handleNewChat} className="gap-2">
              <MessageSquarePlus className="w-4 h-4" />
              New Chat
            </Button>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          Ask questions about metadata, licenses, contracts, tasks, and series.
        </p>
      </div>

      <div
        className={`grid gap-4 flex-1 min-h-0 ${
          hasProposals ? "grid-cols-1 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]" : "grid-cols-1"
        }`}
      >
        <Card
          className={`flex flex-col min-h-[500px] ${
            hasProposals ? "xl:h-[calc(100vh-220px)]" : "xl:h-[calc(100vh-220px)]"
          }`}
        >
          <CardHeader className="pb-2 pt-4 px-4 shrink-0">
            <CardTitle className="text-lg">Conversation</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 overflow-hidden relative min-h-0 px-4">
            <ScrollArea className="h-full pr-4" ref={scrollRef}>
              <div className="space-y-4 pb-4">
                {messages.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-[350px] text-center space-y-3">
                    <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                      <Sparkles className="w-6 h-6 text-muted-foreground" />
                    </div>
                    <div className="max-w-xs">
                      <p className="text-sm font-medium">No conversation started</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Try asking for metadata or suggesting a correction for a specific file.
                      </p>
                    </div>
                  </div>
                )}
                {messages.map((message, index) => (
                  <div
                    key={index}
                    className={`flex flex-col w-full min-w-0 ${
                      message.role === "user" ? "items-end" : "items-start"
                    }`}
                  >
                    <div
                      className={`max-w-[90%] rounded-2xl px-4 py-2.5 break-words shadow-sm ${
                        message.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted"
                      }`}
                    >
                      <p className="text-sm whitespace-pre-wrap leading-relaxed">{message.content}</p>
                      {message.attachments && message.attachments.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-primary-foreground/90">
                          {message.attachments.map((file) => (
                            <span
                              key={file.name}
                              className="inline-flex items-center gap-1 rounded-md bg-primary/20 px-2 py-0.5"
                            >
                              <Paperclip className="w-3 h-3" />
                              {file.name}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    {message.sources && message.sources.length > 0 && (
                      <div className="mt-2 w-full max-w-[90%] rounded-xl border bg-background px-3 py-2 text-xs shadow-sm">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            Sources
                          </span>
                          <Badge variant="secondary" className="h-4 text-xs px-1">{message.sources.length}</Badge>
                        </div>
                        <div className="space-y-1">
                          {message.sources.map((source) => (
                            <div key={source.url} className="flex flex-col">
                              <a
                                href={source.url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-primary text-[11px] underline-offset-4 hover:underline truncate"
                              >
                                {source.title || source.url}
                              </a>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                {isSending && (
                  <div className="flex items-start">
                    <div className="bg-muted rounded-lg px-3 py-2 flex items-center gap-2">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">Thinking...</span>
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
          </CardContent>
          <CardFooter className="p-4 border-t bg-muted/20 shrink-0">
            <div className="w-full flex flex-col gap-2">
               {attachment && (
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-background border rounded-lg text-xs animate-in fade-in slide-in-from-bottom-1">
                    <Paperclip className="h-3 w-3 text-muted-foreground" />
                    <span className="truncate flex-1 font-medium">{attachment.name}</span>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-5 w-5 hover:text-destructive"
                      onClick={() => {
                        setAttachment(null);
                        if (fileInputRef.current) fileInputRef.current.value = "";
                      }}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              <div className="relative flex items-center gap-2 bg-background p-1.5 border rounded-xl shadow-sm focus-within:ring-1 focus-within:ring-primary/30 transition-shadow">
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 shrink-0 text-muted-foreground hover:text-primary"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Paperclip className="h-4 w-4" />
                </Button>
                <Textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask something..."
                  rows={1}
                  className="min-h-[40px] flex-1 border-0 focus-visible:ring-0 focus-visible:ring-offset-0 resize-none py-2.5 px-0 shadow-none text-sm bg-transparent"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                />
                <Button
                  size="icon"
                  className="h-8 w-8 shrink-0 rounded-lg"
                  onClick={handleSend}
                  disabled={isSending || (!input.trim() && !attachment)}
                >
                  {isSending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
                <Input
                  id="ai-chat-attachment"
                  type="file"
                  accept={ACCEPTED_FILE_TYPES}
                  onChange={handleFileChange}
                  ref={fileInputRef}
                  className="hidden"
                />
              </div>
              <p className="text-xs text-center text-muted-foreground px-2">
                AI may generate inaccurate information. Verify important details.
              </p>
            </div>
          </CardFooter>
        </Card>

        {hasProposals && (
          <Card className="flex flex-col min-h-[500px] xl:h-[calc(100vh-220px)]">
            <CardHeader className="pb-2 pt-4 px-4 shrink-0">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-lg">Proposed Changes</CardTitle>
                </div>
                <Badge variant="secondary" className="h-5">{proposalCount}</Badge>
              </div>
            </CardHeader>
            <CardContent className="flex-1 overflow-hidden min-h-0 px-4">
              <ScrollArea className="h-full pr-2">
                <div className="space-y-4 pb-4">
                  {proposalGroups.map((group) => (
                    <div key={group.messageIndex} className="space-y-2">
                      <div className="flex items-center justify-between gap-2 px-1">
                        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                          From message {group.messageIndex + 1}
                        </p>
                        {group.proposals.length > 1 && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs font-semibold shadow-sm border-primary/20 hover:bg-primary/5 px-2"
                                disabled={isExecuting}
                              >
                                <Check className="w-3 h-3 mr-1" />
                                Accept All
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This will apply all {group.proposals.length} proposed changes at once. 
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Review Again</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleExecuteAllProposals(group.messageIndex)}
                                  className="bg-primary text-primary-foreground"
                                >
                                  Yes, I'm sure
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </div>
                      {group.proposals.map((proposal, pIdx) => (
                        <Card
                          key={`${group.messageIndex}-${pIdx}`}
                          className="w-full border-primary/20 bg-primary/5 overflow-hidden flex flex-col shadow-none"
                        >
                          <CardHeader className="p-3 shrink-0">
                            <div className="flex items-center gap-2">
                              <Info className="w-3.5 h-3.5 text-primary" />
                              <CardTitle className="text-xs">
                                {proposal.type} {proposal.action}
                              </CardTitle>
                            </div>
                            {proposal.explanation && (
                              <CardDescription className="text-xs leading-tight">
                                {proposal.explanation}
                              </CardDescription>
                            )}
                          </CardHeader>
                          <CardContent className="px-3 py-0">
                            <div className="text-xs bg-background/50 p-2 rounded border border-primary/10 max-h-32 overflow-auto font-mono">
                              <pre className="whitespace-pre-wrap break-words">
                                {JSON.stringify(proposal.data, null, 2)}
                              </pre>
                            </div>
                          </CardContent>
                          <CardFooter className="p-3 flex flex-wrap items-center justify-end gap-2 shrink-0">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-xs px-2"
                              onClick={() => {
                                setMessages(prev => prev.map((msg, mIdx) => {
                                  if (mIdx === group.messageIndex && msg.proposals) {
                                    return { ...msg, proposals: msg.proposals.filter((_, i) => i !== pIdx) };
                                  }
                                  return msg;
                                }));
                              }}
                            >
                              Dismiss
                            </Button>
                            <Button
                              size="sm"
                              className="h-7 text-xs px-2"
                              disabled={isExecuting}
                              onClick={() => handleExecuteProposal(proposal, group.messageIndex, pIdx)}
                            >
                              {isExecuting ? (
                                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                              ) : (
                                <Check className="w-3 h-3 mr-1" />
                              )}
                              Accept
                            </Button>
                          </CardFooter>
                        </Card>
                      ))}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
