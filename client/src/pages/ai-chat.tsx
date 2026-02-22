import { useEffect, useState, useRef } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Sparkles, Loader2, Check, X, Info, AlertCircle } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type Message = {
  role: "user" | "assistant";
  content: string;
  proposal?: any;
};

export default function AiChat() {
  const { canUseAIChat } = useAuth();
  const { toast } = useToast();
  const [input, setInput] = useState("");
  const [debugEnabled, setDebugEnabled] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.title = "AI Chat | ONS Broadcast Portal";
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isSending) return;

    const userMessage: Message = { role: "user", content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsSending(true);

    try {
      const response = await apiRequest("POST", "/api/ai/chat", {
        messages: [...messages, userMessage].map((m) => ({
          role: m.role,
          content: m.content,
        })),
        debug: debugEnabled,
      });

      const data = await response.json();
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.message, proposal: data.proposal },
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

  const handleExecuteProposal = async (proposal: any, messageIndex: number) => {
    setIsExecuting(true);
    try {
      await apiRequest("POST", "/api/ai/chat/execute-proposal", proposal);
      
      toast({
        title: "Success",
        description: "Change applied successfully.",
      });

      // Update message to show it was applied
      setMessages(prev => prev.map((msg, i) => 
        i === messageIndex ? { ...msg, proposal: { ...msg.proposal, executed: true } } : msg
      ));

      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ["/api/metadata"] });
      queryClient.invalidateQueries({ queryKey: ["/api/licenses"] });
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
    <div className="space-y-8">
      <div>
        <div className="flex items-center gap-3 mb-2">
          <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Sparkles className="w-6 h-6 text-primary" />
          </div>
          <h1 className="text-3xl font-semibold text-foreground">AI Chat</h1>
        </div>
        <p className="text-muted-foreground">
          Ask questions about metadata, licenses, and tasks. Conversations are not stored.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card className="lg:col-span-2 flex flex-col h-[650px]">
          <CardHeader>
            <CardTitle>Conversation</CardTitle>
            <CardDescription>AI suggestions require confirmation before any changes are applied.</CardDescription>
          </CardHeader>
          <CardContent className="flex-grow overflow-hidden relative">
            <ScrollArea className="h-full pr-4" ref={scrollRef}>
              <div className="space-y-6">
                {messages.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-[400px] text-center space-y-4">
                    <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                      <Sparkles className="w-8 h-8 text-muted-foreground" />
                    </div>
                    <div className="max-w-sm">
                      <p className="text-sm font-medium">No conversation started</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Try asking for metadata or suggesting a correction for a specific file.
                      </p>
                    </div>
                  </div>
                )}
                {messages.map((message, index) => (
                  <div
                    key={index}
                    className={`flex flex-col ${
                      message.role === "user" ? "items-end" : "items-start"
                    }`}
                  >
                    <div
                      className={`max-w-[85%] rounded-lg p-3 ${
                        message.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted"
                      }`}
                    >
                      <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                    </div>

                    {message.proposal && (
                      <Card className="mt-4 w-full border-primary/20 bg-primary/5">
                        <CardHeader className="py-3">
                          <div className="flex items-center gap-2">
                            <Info className="w-4 h-4 text-primary" />
                            <CardTitle className="text-sm">Proposed {message.proposal.type} {message.proposal.action}</CardTitle>
                          </div>
                          {message.proposal.explanation && (
                            <CardDescription className="text-xs">
                              {message.proposal.explanation}
                            </CardDescription>
                          )}
                        </CardHeader>
                        <CardContent className="py-2">
                          <pre className="text-[10px] bg-background p-2 rounded border overflow-x-auto">
                            {JSON.stringify(message.proposal.data, null, 2)}
                          </pre>
                        </CardContent>
                        <CardFooter className="py-3 flex justify-end gap-2">
                          {message.proposal.executed ? (
                            <div className="flex items-center gap-1 text-green-600 text-xs font-medium">
                              <Check className="w-4 h-4" /> Applied
                            </div>
                          ) : (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 text-xs"
                                onClick={() => {
                                  setMessages(prev => prev.filter((_, i) => i !== index));
                                }}
                              >
                                <X className="w-3 h-3 mr-1" /> Dismiss
                              </Button>
                              <Button
                                size="sm"
                                className="h-8 text-xs"
                                disabled={isExecuting}
                                onClick={() => handleExecuteProposal(message.proposal, index)}
                              >
                                {isExecuting ? (
                                  <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                                ) : (
                                  <Check className="w-3 h-3 mr-1" />
                                )}
                                Accept Change
                              </Button>
                            </>
                          )}
                        </CardFooter>
                      </Card>
                    )}
                  </div>
                ))}
                {isSending && (
                  <div className="flex items-start">
                    <div className="bg-muted rounded-lg p-3 flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Thinking...</span>
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Prompt</CardTitle>
            <CardDescription>Use clear instructions. Include IDs when requesting updates.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground font-medium">Debug Mode</Label>
              <Switch checked={debugEnabled} onCheckedChange={setDebugEnabled} />
            </div>
            
            <div className="p-3 rounded-lg border bg-yellow-50 border-yellow-100 flex gap-2">
              <AlertCircle className="w-4 h-4 text-yellow-600 shrink-0 mt-0.5" />
              <p className="text-[11px] text-yellow-700 leading-relaxed">
                The AI can search the database and suggest changes. 
                Always verify data before accepting a proposal.
              </p>
            </div>

            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask the AI to search metadata, licenses, or tasks..."
              rows={8}
              className="resize-none"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
            />
            <Button 
              className="w-full" 
              onClick={handleSend}
              disabled={isSending || !input.trim()}
            >
              {isSending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Send className="w-4 h-4 mr-2" />
              )}
              Send Message
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
