import { useState, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Upload, Loader2, FileText, CheckCircle2, XCircle,
  FileUp, Brain, ArrowRight, Sparkles, X, Check, Plus,
  RefreshCw, AlertTriangle,
} from "lucide-react";
import { upload as blobUpload } from "@vercel/blob/client";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type Proposal = {
  type: "metadata";
  action: "create" | "update";
  data: any;
  existingData?: any;
  explanation: string;
};

type Phase = "idle" | "uploading" | "analyzing" | "proposals" | "error";

interface MetadataAiUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const MAX_BODY_SIZE = 4.5 * 1024 * 1024;

export default function MetadataAiUploadDialog({ open, onOpenChange }: MetadataAiUploadDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [phase, setPhase] = useState<Phase>("idle");
  const [file, setFile] = useState<File | null>(null);
  const [blobUrl, setBlobUrl] = useState<string>("");
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [feedback, setFeedback] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [executedCount, setExecutedCount] = useState(0);

  const reset = () => {
    setPhase("idle");
    setFile(null);
    setBlobUrl("");
    setProposals([]);
    setFeedback("");
    setErrorMessage("");
    setExecutedCount(0);
  };

  const handleClose = (isOpen: boolean) => {
    if (!isOpen && phase !== "uploading" && phase !== "analyzing") {
      reset();
      onOpenChange(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      setFile(selected);
      setPhase("idle");
      setProposals([]);
      setErrorMessage("");
    }
  };

  // Parse: upload file + call AI
  const parseMutation = useMutation({
    mutationFn: async (selectedFile: File) => {
      setPhase("uploading");
      let url = "";

      if (selectedFile.size > MAX_BODY_SIZE) {
        const blob = await blobUpload(`ai-uploader/${selectedFile.name}`, selectedFile, {
          access: "private",
          handleUploadUrl: "/api/blob/upload",
          clientPayload: JSON.stringify({ type: "ai-upload" }),
        });
        url = blob.url;
        setBlobUrl(url);
      }

      setPhase("analyzing");

      const token = localStorage.getItem("auth_token");
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;

      let res: Response;
      if (url) {
        headers["Content-Type"] = "application/json";
        res = await fetch("/api/ai/parse-upload", {
          method: "POST",
          headers,
          credentials: "include",
          body: JSON.stringify({ blobUrl: url, type: "metadata" }),
        });
      } else {
        const formData = new FormData();
        formData.append("file", selectedFile);
        formData.append("type", "metadata");
        res = await fetch("/api/ai/parse-upload", {
          method: "POST",
          headers,
          credentials: "include",
          body: formData,
        });
      }

      if (!res.ok) {
        const error = await res.json().catch(() => ({ message: res.statusText }));
        throw new Error(error.message || "AI parsing failed");
      }

      return await res.json();
    },
    onSuccess: (data) => {
      setProposals(data.proposals || []);
      setPhase("proposals");
      toast({ title: "Parsed", description: `AI found ${data.proposals?.length || 0} proposal(s)` });
    },
    onError: (err: Error) => {
      setErrorMessage(err.message);
      setPhase("error");
    },
  });

  // Refine proposals with feedback
  const refineMutation = useMutation({
    mutationFn: async () => {
      if (!file || !feedback) throw new Error("Missing file or feedback");

      let url = blobUrl;
      if (!url && file.size > MAX_BODY_SIZE) {
        const blob = await blobUpload(`ai-uploader/${file.name}`, file, {
          access: "private",
          handleUploadUrl: "/api/blob/upload",
          clientPayload: JSON.stringify({ type: "ai-upload" }),
        });
        url = blob.url;
        setBlobUrl(url);
      }

      const token = localStorage.getItem("auth_token");
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;

      let res: Response;
      if (url) {
        headers["Content-Type"] = "application/json";
        res = await fetch("/api/ai/refine-upload", {
          method: "POST",
          headers,
          credentials: "include",
          body: JSON.stringify({
            blobUrl: url,
            type: "metadata",
            feedback,
            previousProposals: JSON.stringify(proposals),
          }),
        });
      } else {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("type", "metadata");
        formData.append("feedback", feedback);
        formData.append("previousProposals", JSON.stringify(proposals));
        res = await fetch("/api/ai/refine-upload", {
          method: "POST",
          headers,
          credentials: "include",
          body: formData,
        });
      }

      if (!res.ok) {
        const error = await res.json().catch(() => ({ message: res.statusText }));
        throw new Error(error.message || "Refinement failed");
      }

      return await res.json();
    },
    onSuccess: (data) => {
      setProposals(data.proposals || []);
      setFeedback("");
      toast({ title: "Refined", description: "AI has updated the proposals" });
    },
    onError: (err: Error) => {
      toast({ title: "Refinement failed", description: err.message, variant: "destructive" });
    },
  });

  // Execute a single proposal
  const executeMutation = useMutation({
    mutationFn: async (index: number) => {
      const proposal = proposals[index];
      const res = await apiRequest("POST", "/api/ai/execute-proposal", proposal);
      return { result: await res.json(), index };
    },
    onSuccess: ({ index }) => {
      setProposals(prev => prev.filter((_, i) => i !== index));
      setExecutedCount(c => c + 1);
      queryClient.invalidateQueries({ queryKey: ["/api/metadata"] });
      toast({ title: "Applied", description: "Proposal executed" });
    },
    onError: (err: Error) => {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    },
  });

  // Execute all proposals
  const executeAllMutation = useMutation({
    mutationFn: async () => {
      const results = [];
      for (let i = proposals.length - 1; i >= 0; i--) {
        const res = await apiRequest("POST", "/api/ai/execute-proposal", proposals[i]);
        results.push(await res.json());
      }
      return results;
    },
    onSuccess: (results) => {
      setExecutedCount(c => c + results.length);
      setProposals([]);
      queryClient.invalidateQueries({ queryKey: ["/api/metadata"] });
      toast({ title: "All applied", description: `${results.length} proposals executed` });
    },
    onError: (err: Error) => {
      toast({ title: "Batch failed", description: err.message, variant: "destructive" });
    },
  });

  const isProcessing = phase === "uploading" || phase === "analyzing";
  const isBusy = parseMutation.isPending || refineMutation.isPending || executeMutation.isPending || executeAllMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            AI Metadata Upload
          </DialogTitle>
          <DialogDescription>
            Upload an Excel file and let AI extract, match, and create metadata records.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col gap-4">
          {/* File Selection */}
          {phase === "idle" && (
            <div className="space-y-4">
              <div
                className={cn(
                  "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors",
                  file ? "border-primary/50 bg-primary/5" : "border-muted-foreground/25 hover:border-primary/30 hover:bg-muted/50"
                )}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv,.pdf,.txt,.docx"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                {file ? (
                  <div className="flex flex-col items-center gap-2">
                    <FileText className="h-10 w-10 text-primary" />
                    <p className="font-medium">{file.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {(file.size / 1024 / 1024).toFixed(2)} MB — Click to change
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <Upload className="h-10 w-10 text-muted-foreground" />
                    <p className="font-medium">Drop a metadata file or click to browse</p>
                    <p className="text-sm text-muted-foreground">
                      XLSX, XLS, CSV, PDF, TXT, DOCX supported
                    </p>
                  </div>
                )}
              </div>

              {executedCount > 0 && (
                <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-950/30 rounded-lg text-sm">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <span>{executedCount} proposal(s) applied this session</span>
                </div>
              )}

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => { reset(); onOpenChange(false); }}>Cancel</Button>
                <Button
                  onClick={() => file && parseMutation.mutate(file)}
                  disabled={!file || isBusy}
                >
                  {isBusy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ArrowRight className="h-4 w-4 mr-2" />}
                  Analyze with AI
                </Button>
              </div>
            </div>
          )}

          {/* Processing */}
          {isProcessing && (
            <div className="space-y-6 py-8">
              <div className="flex flex-col items-center gap-4">
                {phase === "uploading" ? (
                  <FileUp className="h-10 w-10 text-primary animate-pulse" />
                ) : (
                  <Brain className="h-10 w-10 text-primary animate-pulse" />
                )}
                <p className="font-medium">
                  {phase === "uploading" ? "Uploading file..." : "AI is analyzing the document..."}
                </p>
                <Progress value={phase === "uploading" ? 30 : 65} className="h-2 w-64" />
                <p className="text-sm text-muted-foreground">{file?.name}</p>
              </div>
            </div>
          )}

          {/* Error */}
          {phase === "error" && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 bg-destructive/10 rounded-lg">
                <XCircle className="h-6 w-6 text-destructive shrink-0" />
                <div>
                  <p className="font-medium text-destructive">Analysis Failed</p>
                  <p className="text-sm text-muted-foreground mt-1">{errorMessage}</p>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => { reset(); onOpenChange(false); }}>Close</Button>
                <Button onClick={reset}>Try Again</Button>
              </div>
            </div>
          )}

          {/* Proposals */}
          {phase === "proposals" && (
            <div className="flex-1 flex flex-col gap-3 min-h-0">
              {proposals.length === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle2 className="h-10 w-10 text-green-500 mx-auto mb-3" />
                  <p className="font-medium">
                    {executedCount > 0 ? "All proposals applied!" : "No proposals found"}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {executedCount > 0
                      ? `${executedCount} record(s) created/updated.`
                      : "The AI couldn't extract metadata from this file. Try a different file or format."}
                  </p>
                  <div className="flex justify-center gap-2 mt-4">
                    <Button variant="outline" onClick={() => { reset(); onOpenChange(false); }}>Close</Button>
                    <Button onClick={reset}>Upload Another</Button>
                  </div>
                </div>
              ) : (
                <>
                  {/* Header */}
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">{proposals.length} proposal(s)</p>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => executeAllMutation.mutate()}
                        disabled={isBusy}
                      >
                        {executeAllMutation.isPending ? (
                          <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                        ) : (
                          <Check className="h-3.5 w-3.5 mr-1.5" />
                        )}
                        Apply All
                      </Button>
                    </div>
                  </div>

                  {/* Proposal list */}
                  <ScrollArea className="flex-1 -mx-2 px-2">
                    <div className="space-y-2">
                      {proposals.map((p, i) => (
                        <div
                          key={i}
                          className="border rounded-lg p-3 space-y-2"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <Badge variant={p.action === "create" ? "default" : "secondary"}>
                                  {p.action}
                                </Badge>
                                <span className="font-medium text-sm truncate">
                                  {p.data.title || p.data.seriesTitle || "Unknown"}
                                </span>
                                {p.data.season && (
                                  <span className="text-xs text-muted-foreground">S{p.data.season}</span>
                                )}
                                {p.data.episode && (
                                  <span className="text-xs text-muted-foreground">E{p.data.episode}</span>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                {p.explanation}
                              </p>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7 text-destructive"
                                onClick={() => setProposals(prev => prev.filter((_, j) => j !== i))}
                                disabled={isBusy}
                                title="Discard"
                              >
                                <X className="h-3.5 w-3.5" />
                              </Button>
                              {p.action === "update" && (
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-7 w-7"
                                  onClick={() => executeMutation.mutate(i)}
                                  disabled={isBusy}
                                  title="Create as New"
                                >
                                  <Plus className="h-3.5 w-3.5" />
                                </Button>
                              )}
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7 text-green-600"
                                onClick={() => executeMutation.mutate(i)}
                                disabled={isBusy}
                                title="Apply"
                              >
                                <Check className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>

                          {/* Key fields preview */}
                          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                            {p.data.duration && <span>Duration: {p.data.duration}</span>}
                            {p.data.episodeTitle && <span>Title: {p.data.episodeTitle}</span>}
                            {p.data.genre?.length > 0 && <span>Genre: {p.data.genre.join(", ")}</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>

                  {/* Refinement */}
                  <div className="border-t pt-3 space-y-2">
                    <div className="flex gap-2">
                      <Textarea
                        placeholder="Feedback for AI (e.g. 'Group by season', 'Fix durations')..."
                        value={feedback}
                        onChange={(e) => setFeedback(e.target.value)}
                        rows={2}
                        className="text-sm resize-none"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        className="shrink-0 self-end"
                        onClick={() => refineMutation.mutate()}
                        disabled={!feedback.trim() || isBusy}
                      >
                        {refineMutation.isPending ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <RefreshCw className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="sm" onClick={() => { reset(); onOpenChange(false); }}>
                        Done
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
