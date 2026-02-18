import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Sparkles, Upload, FileText, Check, X, Loader2, AlertCircle, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useMutation } from "@tanstack/react-query";

type Proposal = {
  type: "license" | "metadata";
  action: "create" | "update";
  data: any;
  existingData?: any;
  explanation: string;
};

export default function AiUpload() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [uploadType, setUploadType] = useState<"license" | "metadata">("license");
  const [proposals, setProposals] = useState<Proposal[] | null>(null);

  const parseMutation = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("Please select a file");
      
      const formData = new FormData();
      formData.append("file", file);
      formData.append("type", uploadType);
      
      const res = await fetch("/api/ai/parse-upload", {
        method: "POST",
        body: formData,
      });
      
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to parse file");
      }
      
      return await res.json();
    },
    onSuccess: (data) => {
      setProposals(data.proposals);
      toast({ title: "Success", description: `AI parsed ${data.proposals.length} proposal(s)` });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const executeMutation = useMutation({
    mutationFn: async (arg: number | Proposal) => {
      const proposal = typeof arg === "number" ? proposals![arg] : arg;
      const res = await apiRequest("POST", "/api/ai/execute-proposal", proposal);
      return { result: await res.json(), index: typeof arg === "number" ? arg : -1 };
    },
    onSuccess: (data) => {
      toast({ title: "Success", description: "Proposal executed successfully" });
      // Remove the executed proposal from the list if we have an index
      if (data.index !== -1) {
        setProposals(prev => prev ? prev.filter((_, i) => i !== data.index) : null);
      } else {
        // If it was a custom proposal (Create as New), we can't easily find the index to remove
        // So we clear the proposals or re-fetch (simplest is to just clear this specific one if we can find it)
        // For now, let's just clear the whole list or assume the user will discard it
        setProposals(null); 
      }
      queryClient.invalidateQueries();
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      const MAX_FILE_SIZE = 4.5 * 1024 * 1024; // 4.5MB for Vercel
      
      if (selectedFile.size > MAX_FILE_SIZE) {
        toast({
          title: "File too large",
          description: "Vercel limits uploads to 4.5MB. Please upload a smaller file.",
          variant: "destructive",
        });
        e.target.value = ""; // Clear the input
        return;
      }
      
      setFile(selectedFile);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <div className="flex items-center gap-3 mb-2">
          <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Sparkles className="w-6 h-6 text-primary" />
          </div>
          <h1 className="text-3xl font-semibold text-foreground">AI Upload</h1>
        </div>
        <p className="text-muted-foreground">
          Upload PDF contracts or metadata files to automatically parse and import data using AI.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card className="lg:col-span-1 h-fit">
          <CardHeader>
            <CardTitle>Upload Document</CardTitle>
            <CardDescription>Select a file and type to begin parsing</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <Label>Parsing Mode</Label>
              <RadioGroup
                value={uploadType}
                onValueChange={(v: any) => setUploadType(v)}
                className="grid grid-cols-2 gap-4"
              >
                <div>
                  <RadioGroupItem value="license" id="mode-license" className="peer sr-only" />
                  <Label
                    htmlFor="mode-license"
                    className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"
                  >
                    <FileText className="mb-3 h-6 w-6" />
                    License Contract
                  </Label>
                </div>
                <div>
                  <RadioGroupItem value="metadata" id="mode-metadata" className="peer sr-only" />
                  <Label
                    htmlFor="mode-metadata"
                    className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"
                  >
                    <Upload className="mb-3 h-6 w-6" />
                    Metadata File
                  </Label>
                </div>
              </RadioGroup>
            </div>

            <div className="space-y-2">
              <Label htmlFor="file-upload">Document (PDF, CSV, XLSX, DOCX, TXT)</Label>
              <Input
                id="file-upload"
                type="file"
                accept=".pdf,.csv,.xlsx,.docx,.txt"
                onChange={handleFileChange}
                className="cursor-pointer"
              />
            </div>

            <Button
              className="w-full"
              disabled={!file || parseMutation.isPending}
              onClick={() => parseMutation.mutate()}
            >
              {parseMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Parsing with Gemini...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Parse Document
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            Proposed Changes
            {proposals && (
              <Badge variant="secondary">{proposals.length}</Badge>
            )}
          </h2>

          {!proposals ? (
            <Card className="border-dashed border-2 flex flex-col items-center justify-center p-12 text-center text-muted-foreground">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <Upload className="w-8 h-8" />
              </div>
              <p>Upload a document to see AI-proposed changes here.</p>
              <p className="text-sm mt-2">Gemini will analyze the content and suggest database updates.</p>
            </Card>
          ) : proposals.length === 0 ? (
            <Card className="p-12 text-center text-muted-foreground">
              <AlertCircle className="w-12 h-12 mx-auto mb-4 text-yellow-500" />
              <p>No actionable data found in the uploaded file.</p>
              <Button variant="link" onClick={() => setProposals(null)}>Try another file</Button>
            </Card>
          ) : (
            <ScrollArea className="h-[calc(100vh-250px)]">
              <div className="space-y-6 pr-4">
                {proposals.map((proposal, index) => (
                  <Card key={index} className="overflow-hidden border-primary/20">
                    <div className="bg-primary/5 px-6 py-3 border-b border-primary/10 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant={proposal.action === "create" ? "default" : "secondary"}>
                          {proposal.action === "create" ? "CREATE NEW" : "UPDATE EXISTING"}
                        </Badge>
                        <span className="font-medium text-sm">
                          {proposal.type.toUpperCase()}: {proposal.data.name || proposal.data.title || "Unnamed Item"}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0 text-destructive"
                          onClick={() => setProposals(prev => prev!.filter((_, i) => i !== index))}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <CardContent className="p-6">
                      <p className="text-sm text-muted-foreground mb-4 italic">
                        "{proposal.explanation}"
                      </p>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            Proposed Data
                          </h4>
                          <div className="bg-muted p-3 rounded-md text-xs font-mono whitespace-pre-wrap">
                            {JSON.stringify(proposal.data, null, 2)}
                          </div>
                        </div>

                        {proposal.action === "update" && proposal.existingData && (
                          <div className="space-y-2">
                            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                              Existing Data
                            </h4>
                            <div className="bg-muted/50 p-3 rounded-md text-xs font-mono whitespace-pre-wrap opacity-60">
                              {JSON.stringify(proposal.existingData, null, 2)}
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="mt-6 flex justify-end gap-3">
                        <Button 
                          variant="outline" 
                          onClick={() => setProposals(prev => prev!.filter((_, i) => i !== index))}
                        >
                          Discard
                        </Button>
                        
                        {proposal.action === "update" && (
                          <Button 
                            variant="secondary"
                            onClick={() => {
                              const newData = { ...proposal.data };
                              delete newData.id;
                              executeMutation.mutate({ 
                                ...proposal, 
                                action: "create", 
                                data: newData 
                              } as any);
                            }}
                            disabled={executeMutation.isPending}
                          >
                            {executeMutation.isPending ? (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                              <Plus className="mr-2 h-4 w-4" />
                            )}
                            Create as New
                          </Button>
                        )}

                        <Button 
                          onClick={() => executeMutation.mutate(index)}
                          disabled={executeMutation.isPending}
                        >
                          {executeMutation.isPending ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <Check className="mr-2 h-4 w-4" />
                          )}
                          Approve & Apply
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>
      </div>
    </div>
  );
}
