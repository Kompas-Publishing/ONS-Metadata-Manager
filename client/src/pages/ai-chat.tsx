import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Sparkles } from "lucide-react";

export default function AiChat() {
  const { canUseAIChat } = useAuth();
  const [input, setInput] = useState("");
  const [debugEnabled, setDebugEnabled] = useState(false);

  useEffect(() => {
    document.title = "AI Chat | ONS Broadcast Portal";
  }, []);

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
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Conversation</CardTitle>
            <CardDescription>AI suggestions require confirmation before any changes are applied.</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[520px] pr-4">
              <div className="space-y-4">
                <div className="text-sm text-muted-foreground">
                  Start by asking something like: "Show metadata for Ballykissangel season 2."
                </div>
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
              <Label className="text-xs text-muted-foreground">Debug Mode</Label>
              <Switch checked={debugEnabled} onCheckedChange={setDebugEnabled} />
            </div>
            <div className="space-y-2">
              <Input type="file" accept=".txt,.csv,.md,.json" disabled />
            </div>
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask the AI to search metadata, licenses, or tasks..."
              rows={6}
            />
            <Button className="w-full" disabled>
              <Send className="w-4 h-4 mr-2" />
              Send
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
