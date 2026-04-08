import { useState, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Upload, Loader2, FileText, CheckCircle2, AlertTriangle, XCircle,
  FileUp, Brain, Database, ArrowRight, Shield,
} from "lucide-react";
import { upload as blobUpload } from "@vercel/blob/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type IngestPhase =
  | "idle"
  | "uploading"
  | "extracting"
  | "analyzing"
  | "creating"
  | "complete"
  | "error";

interface IngestSummary {
  classification: string;
  contractMode: string | null;
  contractId: string | null;
  contractAction: "created" | "updated";
  licensesCreated: number;
  licensesUpdated: number;
  seriesLinksCreated: number;
  metadataLinksCreated: number;
  newContentRows: number;
  warnings: string[];
  licenseDetails: Array<{
    id: string;
    name: string;
    action: "created" | "updated";
    contentItems: number;
  }>;
}

const PHASE_LABELS: Record<IngestPhase, string> = {
  idle: "Ready to upload",
  uploading: "Uploading contract file...",
  extracting: "Extracting text from document...",
  analyzing: "AI analyzing contract terms...",
  creating: "Creating and linking records...",
  complete: "Ingest complete",
  error: "Ingest failed",
};

const PHASE_PROGRESS: Record<IngestPhase, number> = {
  idle: 0,
  uploading: 15,
  extracting: 30,
  analyzing: 55,
  creating: 80,
  complete: 100,
  error: 0,
};

const CLASSIFICATION_LABELS: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  inbound_license: { label: "Inbound License", variant: "default" },
  amendment: { label: "Amendment", variant: "secondary" },
  outbound: { label: "Outbound / Sublicense", variant: "outline" },
  invoice: { label: "Invoice", variant: "outline" },
  issue: { label: "Issue", variant: "destructive" },
};

interface ContractIngestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function ContractIngestDialog({ open, onOpenChange }: ContractIngestDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [phase, setPhase] = useState<IngestPhase>("idle");
  const [file, setFile] = useState<File | null>(null);
  const [summary, setSummary] = useState<IngestSummary | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>("");

  const reset = () => {
    setPhase("idle");
    setFile(null);
    setSummary(null);
    setErrorMessage("");
  };

  const handleClose = (isOpen: boolean) => {
    if (!isOpen && phase !== "uploading" && phase !== "extracting" && phase !== "analyzing" && phase !== "creating") {
      reset();
      onOpenChange(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      setFile(selected);
      setPhase("idle");
      setSummary(null);
      setErrorMessage("");
    }
  };

  const ingestMutation = useMutation({
    mutationFn: async (selectedFile: File) => {
      // Step 1: Upload to blob
      setPhase("uploading");
      const ext = selectedFile.name.split(".").pop() || "pdf";
      const randomName = `contracts/ingest-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const blob = await blobUpload(randomName, selectedFile, {
        access: "private",
        handleUploadUrl: "/api/blob/upload",
        clientPayload: JSON.stringify({ type: "contract" }),
      });

      // Step 2: Call ingest endpoint
      setPhase("extracting");
      // Short delay for UX — the AI call will take the bulk of time
      await new Promise(r => setTimeout(r, 500));
      setPhase("analyzing");

      const token = localStorage.getItem("auth_token");
      const res = await fetch("/api/contracts/ingest", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: "include",
        body: JSON.stringify({
          blobUrl: blob.url,
          fileName: selectedFile.name,
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || res.statusText);
      }

      setPhase("creating");
      const result: IngestSummary = await res.json();
      return result;
    },
    onSuccess: (result) => {
      setSummary(result);
      setPhase("complete");
      queryClient.invalidateQueries({ queryKey: ["/api/contracts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/licenses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/series"] });
      toast({ title: "Contract ingested successfully" });
    },
    onError: (err: Error) => {
      setErrorMessage(err.message);
      setPhase("error");
      toast({ title: "Ingest failed", description: err.message, variant: "destructive" });
    },
  });

  const PhaseIcon = ({ current }: { current: IngestPhase }) => {
    const icons: Record<IngestPhase, React.ReactNode> = {
      idle: <FileUp className="h-5 w-5" />,
      uploading: <Upload className="h-5 w-5 animate-pulse" />,
      extracting: <FileText className="h-5 w-5 animate-pulse" />,
      analyzing: <Brain className="h-5 w-5 animate-pulse" />,
      creating: <Database className="h-5 w-5 animate-pulse" />,
      complete: <CheckCircle2 className="h-5 w-5 text-green-500" />,
      error: <XCircle className="h-5 w-5 text-destructive" />,
    };
    return icons[current];
  };

  const isProcessing = ["uploading", "extracting", "analyzing", "creating"].includes(phase);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Upload & Ingest Contract
          </DialogTitle>
          <DialogDescription>
            Upload a contract file to automatically extract licenses, link content, and create records.
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
                  accept=".pdf,.doc,.docx,.txt,.rtf,.odt,.xls,.xlsx,.csv"
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
                    <p className="font-medium">Drop contract file or click to browse</p>
                    <p className="text-sm text-muted-foreground">
                      PDF, DOC, DOCX, TXT, XLSX supported
                    </p>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                <Button
                  onClick={() => file && ingestMutation.mutate(file)}
                  disabled={!file || ingestMutation.isPending}
                >
                  <ArrowRight className="h-4 w-4 mr-2" />
                  Start Ingest
                </Button>
              </div>
            </div>
          )}

          {/* Processing State */}
          {isProcessing && (
            <div className="space-y-6 py-4">
              <div className="flex items-center gap-3">
                <PhaseIcon current={phase} />
                <div className="flex-1">
                  <p className="font-medium">{PHASE_LABELS[phase]}</p>
                  <p className="text-sm text-muted-foreground">
                    {file?.name}
                  </p>
                </div>
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
              <Progress value={PHASE_PROGRESS[phase]} className="h-2" />

              {/* Step indicators */}
              <div className="grid grid-cols-4 gap-2 text-xs">
                {(["uploading", "extracting", "analyzing", "creating"] as const).map((step) => {
                  const stepIndex = ["uploading", "extracting", "analyzing", "creating"].indexOf(step);
                  const currentIndex = ["uploading", "extracting", "analyzing", "creating"].indexOf(phase);
                  const isDone = stepIndex < currentIndex;
                  const isCurrent = step === phase;

                  return (
                    <div
                      key={step}
                      className={cn(
                        "flex flex-col items-center gap-1 p-2 rounded transition-colors",
                        isCurrent && "bg-primary/10 text-primary",
                        isDone && "text-green-600",
                        !isCurrent && !isDone && "text-muted-foreground"
                      )}
                    >
                      {isDone ? (
                        <CheckCircle2 className="h-4 w-4" />
                      ) : isCurrent ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <div className="h-4 w-4 rounded-full border" />
                      )}
                      <span className="text-center">
                        {step === "uploading" && "Upload"}
                        {step === "extracting" && "Extract"}
                        {step === "analyzing" && "Analyze"}
                        {step === "creating" && "Create"}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Error State */}
          {phase === "error" && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 bg-destructive/10 rounded-lg">
                <XCircle className="h-6 w-6 text-destructive shrink-0" />
                <div>
                  <p className="font-medium text-destructive">Ingest Failed</p>
                  <p className="text-sm text-muted-foreground mt-1">{errorMessage}</p>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => { reset(); onOpenChange(false); }}>Close</Button>
                <Button onClick={reset}>Try Again</Button>
              </div>
            </div>
          )}

          {/* Complete State — Summary */}
          {phase === "complete" && summary && (
            <ScrollArea className="flex-1 -mx-2 px-2">
              <div className="space-y-4">
                {/* Classification & Mode */}
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant={CLASSIFICATION_LABELS[summary.classification]?.variant || "outline"}>
                    {CLASSIFICATION_LABELS[summary.classification]?.label || summary.classification}
                  </Badge>
                  {summary.contractMode && (
                    <Badge variant="secondary">{summary.contractMode}</Badge>
                  )}
                  <Badge variant="outline">{summary.contractAction}</Badge>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <StatCard label="Licenses Created" value={summary.licensesCreated} />
                  <StatCard label="Licenses Updated" value={summary.licensesUpdated} />
                  <StatCard label="Series Links" value={summary.seriesLinksCreated} />
                  <StatCard label="Content Links" value={summary.metadataLinksCreated} />
                </div>

                {summary.newContentRows > 0 && (
                  <Card>
                    <CardContent className="p-3">
                      <p className="text-sm">
                        <span className="font-medium">{summary.newContentRows}</span> new draft content rows created
                      </p>
                    </CardContent>
                  </Card>
                )}

                {/* License Details */}
                {summary.licenseDetails.length > 0 && (
                  <Card>
                    <CardContent className="p-3 space-y-2">
                      <p className="text-sm font-medium">Licenses</p>
                      {summary.licenseDetails.map((lic, i) => (
                        <div key={i} className="flex items-center justify-between text-sm py-1 border-b last:border-0">
                          <span>{lic.name}</span>
                          <div className="flex items-center gap-2">
                            {lic.contentItems > 0 && (
                              <span className="text-xs text-muted-foreground">{lic.contentItems} titles</span>
                            )}
                            <Badge variant={lic.action === "created" ? "default" : "secondary"} className="text-xs">
                              {lic.action}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}

                {/* Warnings */}
                {summary.warnings.length > 0 && (
                  <Card>
                    <CardContent className="p-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-yellow-500" />
                        <p className="text-sm font-medium">Warnings ({summary.warnings.length})</p>
                      </div>
                      {summary.warnings.map((w, i) => (
                        <p key={i} className="text-xs text-muted-foreground pl-6">{w}</p>
                      ))}
                    </CardContent>
                  </Card>
                )}

                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" onClick={() => { reset(); onOpenChange(false); }}>Close</Button>
                  {summary.contractId && (
                    <Button onClick={() => {
                      reset();
                      onOpenChange(false);
                      window.location.href = `/contracts/${summary.contractId}`;
                    }}>
                      View Contract
                    </Button>
                  )}
                </div>
              </div>
            </ScrollArea>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="p-3 text-center">
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  );
}
