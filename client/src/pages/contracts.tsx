import { useEffect, useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Plus, Search, FileText, Download, Trash2, Pencil, ChevronDown, ChevronUp,
  Upload, Loader2, ExternalLink, ArrowLeft,
} from "lucide-react";
import { format } from "date-fns";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { upload } from "@vercel/blob/client";
import type { License } from "@shared/schema";
import { cn } from "@/lib/utils";

interface ContractWithStats {
  id: string;
  name: string;
  distributor: string;
  description: string | null;
  notes: string | null;
  fileUrl: string | null;
  fileName: string | null;
  sharedTerms: any;
  createdAt: string | null;
  licenseCount: number;
  totalCost: number;
}

interface ContractDetail extends ContractWithStats {
  licenses: License[];
}

export default function Contracts() {
  const { canAccessContracts } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [openDistributors, setOpenDistributors] = useState<Record<string, boolean>>({});
  const [createOpen, setCreateOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  useEffect(() => {
    document.title = "Contracts | ONS Broadcast Portal";
  }, []);

  const { data: contractsList, isLoading } = useQuery<ContractWithStats[]>({
    queryKey: ["/api/contracts"],
    enabled: !!canAccessContracts,
  });

  const { data: contractDetail } = useQuery<ContractDetail>({
    queryKey: [`/api/contracts/${detailId}`],
    enabled: !!detailId,
  });

  const { data: allLicenses } = useQuery<License[]>({
    queryKey: ["/api/licenses"],
  });

  // Group by distributor
  const grouped = useMemo(() => {
    if (!contractsList) return {};
    const filtered = contractsList.filter(c =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.distributor.toLowerCase().includes(search.toLowerCase())
    );
    const groups: Record<string, ContractWithStats[]> = {};
    filtered.forEach(c => {
      if (!groups[c.distributor]) groups[c.distributor] = [];
      groups[c.distributor].push(c);
    });
    return groups;
  }, [contractsList, search]);

  const toggleDistributor = (d: string) => {
    setOpenDistributors(prev => ({ ...prev, [d]: !(prev[d] ?? true) }));
  };

  // Create mutation
  const [newContract, setNewContract] = useState({ name: "", distributor: "", description: "", notes: "" });
  const [uploading, setUploading] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<{ url: string; name: string } | null>(null);

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/contracts", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contracts"] });
      setCreateOpen(false);
      setNewContract({ name: "", distributor: "", description: "", notes: "" });
      setUploadedFile(null);
      toast({ title: "Contract created" });
    },
    onError: (err: Error) => {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/contracts/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contracts"] });
      if (detailId) setDetailId(null);
      toast({ title: "Contract deleted" });
    },
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      // Randomize filename to prevent duplicates
      const ext = file.name.split(".").pop() || "pdf";
      const randomName = `contract-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const blob = await upload(randomName, file, {
        access: "public",
        handleUploadUrl: "/api/blob/upload",
      });
      setUploadedFile({ url: blob.url, name: file.name });
      toast({ title: "File uploaded" });
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const linkLicenseMutation = useMutation({
    mutationFn: async ({ contractId, licenseId }: { contractId: string; licenseId: string }) => {
      await apiRequest("POST", `/api/contracts/${contractId}/licenses`, { licenseId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contracts"] });
      if (detailId) queryClient.invalidateQueries({ queryKey: [`/api/contracts/${detailId}`] });
      toast({ title: "License linked" });
    },
  });

  const unlinkLicenseMutation = useMutation({
    mutationFn: async ({ contractId, licenseId }: { contractId: string; licenseId: string }) => {
      await apiRequest("DELETE", `/api/contracts/${contractId}/licenses`, { licenseId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contracts"] });
      if (detailId) queryClient.invalidateQueries({ queryKey: [`/api/contracts/${detailId}`] });
      toast({ title: "License unlinked" });
    },
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(amount);
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full rounded-lg" />)}
      </div>
    );
  }

  // Detail view
  if (detailId && contractDetail) {
    const totalCost = contractDetail.licenses.reduce((sum, l) => {
      const amt = l.licenseFeeAmount ? parseFloat(l.licenseFeeAmount) : 0;
      return sum + (isNaN(amt) ? 0 : amt);
    }, 0);

    return (
      <div className="space-y-6 max-w-5xl mx-auto">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setDetailId(null)}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold tracking-tight">{contractDetail.name}</h1>
            <p className="text-sm text-muted-foreground">{contractDetail.distributor}</p>
          </div>
          {contractDetail.fileUrl && (
            <a href={contractDetail.fileUrl} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="sm" className="gap-2">
                <Download className="w-4 h-4" />
                Download Contract
              </Button>
            </a>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold">{contractDetail.licenses.length}</p>
              <p className="text-xs text-muted-foreground">Linked Licenses</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold">{formatCurrency(totalCost)}</p>
              <p className="text-xs text-muted-foreground">Total License Cost</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold">{contractDetail.createdAt ? format(new Date(contractDetail.createdAt), "dd MMM yyyy") : "—"}</p>
              <p className="text-xs text-muted-foreground">Created</p>
            </CardContent>
          </Card>
        </div>

        {/* Description & Notes */}
        {(contractDetail.description || contractDetail.notes) && (
          <Card>
            <CardContent className="p-4 space-y-3">
              {contractDetail.description && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase mb-1">Description</p>
                  <p className="text-sm">{contractDetail.description}</p>
                </div>
              )}
              {contractDetail.notes && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase mb-1">Notes</p>
                  <p className="text-sm whitespace-pre-wrap">{contractDetail.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Shared terms */}
        {contractDetail.sharedTerms && (
          <Card>
            <CardContent className="p-4">
              <p className="text-xs font-medium text-muted-foreground uppercase mb-2">Shared Terms</p>
              <div className="flex gap-4 text-sm">
                {contractDetail.sharedTerms.license_period_start && (
                  <span>Start: {contractDetail.sharedTerms.license_period_start}</span>
                )}
                {contractDetail.sharedTerms.license_period_end && (
                  <span>End: {contractDetail.sharedTerms.license_period_end}</span>
                )}
                {contractDetail.sharedTerms.allowed_runs && (
                  <span>Runs: {contractDetail.sharedTerms.allowed_runs}</span>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Linked licenses */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Linked Licenses</h2>
            <LinkLicenseButton
              contractId={detailId}
              existingIds={contractDetail.licenses.map(l => l.id)}
              allLicenses={allLicenses || []}
              onLink={(licenseId) => linkLicenseMutation.mutate({ contractId: detailId, licenseId })}
            />
          </div>
          {contractDetail.licenses.length > 0 ? (
            <div className="border rounded-md overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead className="text-xs">License</TableHead>
                    <TableHead className="text-xs">Season</TableHead>
                    <TableHead className="text-xs">Fee</TableHead>
                    <TableHead className="text-xs text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contractDetail.licenses.map(license => (
                    <TableRow key={license.id}>
                      <TableCell>
                        <Link href={`/licenses/${license.id}`} className="text-primary hover:underline text-sm">
                          {license.name}
                        </Link>
                        {license.contentTitle && license.contentTitle !== license.name && (
                          <span className="text-xs text-muted-foreground ml-2">{license.contentTitle}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">{license.season || "—"}</TableCell>
                      <TableCell className="text-sm font-mono">
                        {license.licenseFeeAmount ? formatCurrency(parseFloat(license.licenseFeeAmount)) : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive h-7"
                          onClick={() => unlinkLicenseMutation.mutate({ contractId: detailId, licenseId: license.id })}
                        >
                          Unlink
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-4 text-center">No licenses linked yet.</p>
          )}
        </div>
      </div>
    );
  }

  // List view
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Contracts</h1>
          <p className="text-muted-foreground mt-1">
            {contractsList?.length || 0} contracts from {Object.keys(grouped).length} distributors
          </p>
        </div>
        <Button className="gap-2" onClick={() => setCreateOpen(true)}>
          <Plus className="w-4 h-4" />
          Add Contract
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search contracts or distributors..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {Object.keys(grouped).length === 0 ? (
        <div className="border-2 border-dashed rounded-lg p-12 text-center">
          <FileText className="w-10 h-10 text-muted-foreground/20 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No contracts found</p>
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)).map(([distributor, items]) => {
            const isOpen = openDistributors[distributor] ?? true;
            const distributorTotal = items.reduce((sum, c) => sum + c.totalCost, 0);
            return (
              <Collapsible key={distributor} open={isOpen} onOpenChange={() => toggleDistributor(distributor)}>
                <div className="flex items-center justify-between p-3 bg-muted/40 rounded-lg cursor-pointer hover:bg-muted/60" onClick={() => toggleDistributor(distributor)}>
                  <div className="flex items-center gap-3">
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" size="sm" className="p-0 h-6 w-6">
                        {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </Button>
                    </CollapsibleTrigger>
                    <span className="font-semibold">{distributor}</span>
                    <Badge variant="secondary" className="text-xs">{items.length}</Badge>
                  </div>
                  <span className="text-sm text-muted-foreground font-mono">{formatCurrency(distributorTotal)}</span>
                </div>
                <CollapsibleContent>
                  <div className="ml-4 mt-2 space-y-1 border-l-2 border-muted pl-4">
                    {items.map(contract => (
                      <div
                        key={contract.id}
                        className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/30 cursor-pointer transition-colors"
                        onClick={() => setDetailId(contract.id)}
                      >
                        <div className="min-w-0">
                          <span className="text-sm font-medium">{contract.name}</span>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                            <span>{contract.licenseCount} licenses</span>
                            <span className="font-mono">{formatCurrency(contract.totalCost)}</span>
                            {contract.fileUrl && <FileText className="w-3 h-3" />}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={e => e.stopPropagation()}>
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent onClick={e => e.stopPropagation()}>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete contract?</AlertDialogTitle>
                                <AlertDialogDescription>This will permanently delete "{contract.name}".</AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => deleteMutation.mutate(contract.id)} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    ))}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            );
          })}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Contract</DialogTitle>
            <DialogDescription>Add a new contract with optional file upload.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Contract Name</label>
              <Input
                value={newContract.name}
                onChange={e => setNewContract(p => ({ ...p, name: e.target.value }))}
                placeholder="e.g. BBC - December Package (2024-01-09)"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Distributor</label>
              <Input
                value={newContract.distributor}
                onChange={e => setNewContract(p => ({ ...p, distributor: e.target.value }))}
                placeholder="e.g. BBC Studios Distribution Limited"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Description</label>
              <Textarea
                value={newContract.description}
                onChange={e => setNewContract(p => ({ ...p, description: e.target.value }))}
                placeholder="Optional description..."
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Notes</label>
              <Textarea
                value={newContract.notes}
                onChange={e => setNewContract(p => ({ ...p, notes: e.target.value }))}
                placeholder="Optional notes..."
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Contract File (PDF)</label>
              {uploadedFile ? (
                <div className="flex items-center gap-2 p-2 bg-muted/50 rounded text-sm">
                  <FileText className="w-4 h-4 text-muted-foreground" />
                  <span className="truncate flex-1">{uploadedFile.name}</span>
                  <Button variant="ghost" size="sm" className="h-6" onClick={() => setUploadedFile(null)}>Remove</Button>
                </div>
              ) : (
                <div>
                  <input type="file" accept=".pdf,.doc,.docx" onChange={handleFileUpload} className="hidden" id="contract-upload" />
                  <Button variant="outline" size="sm" className="gap-2" onClick={() => document.getElementById("contract-upload")?.click()} disabled={uploading}>
                    {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                    {uploading ? "Uploading..." : "Upload File"}
                  </Button>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button
              onClick={() => createMutation.mutate({
                ...newContract,
                fileUrl: uploadedFile?.url || undefined,
                fileName: uploadedFile?.name || undefined,
              })}
              disabled={!newContract.name || !newContract.distributor || createMutation.isPending}
            >
              {createMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Small helper component for linking licenses
function LinkLicenseButton({ contractId, existingIds, allLicenses, onLink }: {
  contractId: string;
  existingIds: string[];
  allLicenses: License[];
  onLink: (licenseId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState("");
  const available = allLicenses.filter(l => !existingIds.includes(l.id));

  return (
    <>
      <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setOpen(true)}>
        <Plus className="w-3.5 h-3.5" /> Link License
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Link License</DialogTitle>
          </DialogHeader>
          <Select value={selected} onValueChange={setSelected}>
            <SelectTrigger>
              <SelectValue placeholder="Select a license..." />
            </SelectTrigger>
            <SelectContent>
              {available.map(l => (
                <SelectItem key={l.id} value={l.id}>
                  {l.name} {l.season ? `(S${l.season})` : ""} — {l.distributor}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button disabled={!selected} onClick={() => { onLink(selected); setSelected(""); setOpen(false); }}>
              Link
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
