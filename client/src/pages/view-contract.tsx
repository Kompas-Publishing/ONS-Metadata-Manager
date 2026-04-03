import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRoute, useLocation, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ArrowLeft, Download, Plus, Trash2, Pencil, Save, Loader2, Upload, FileText, X } from "lucide-react";
import { format } from "date-fns";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { upload } from "@vercel/blob/client";
import type { License } from "@shared/schema";
import { cn } from "@/lib/utils";

interface ContractDetail {
  id: string;
  name: string;
  distributor: string;
  contractMode: string | null;
  status: string;
  description: string | null;
  notes: string | null;
  totalFeeAmount: string | null;
  totalFeeCurrency: string | null;
  sharedTerms: any;
  createdAt: string | null;
  files: { id: string; fileUrl: string; fileName: string; fileRole: string | null; notes: string | null }[];
  licenseLinks: {
    id: string;
    licenseId: string;
    sourceTitle: string | null;
    sourceTitles: any;
    packageLabel: string | null;
    sourceReference: string | null;
    notes: string | null;
    mappingStatus: string | null;
    license: License;
  }[];
}

export default function ViewContract() {
  const [, params] = useRoute("/contracts/:id");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const id = params?.id;

  useEffect(() => {
    document.title = "Contract Details | ONS Broadcast Portal";
  }, []);

  const { data: contract, isLoading } = useQuery<ContractDetail>({
    queryKey: [`/api/contracts/${id}`],
    enabled: !!id,
  });

  const { data: allLicenses } = useQuery<License[]>({
    queryKey: ["/api/licenses"],
  });

  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState({ name: "", distributor: "", description: "", notes: "", totalFeeAmount: "" });
  const [linkOpen, setLinkOpen] = useState(false);
  const [selectedLicense, setSelectedLicense] = useState("");
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (contract) {
      setEditData({
        name: contract.name,
        distributor: contract.distributor,
        description: contract.description || "",
        notes: contract.notes || "",
        totalFeeAmount: contract.totalFeeAmount || "",
      });
    }
  }, [contract]);

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("PATCH", `/api/contracts/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/contracts/${id}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/contracts"] });
      setEditing(false);
      toast({ title: "Contract updated" });
    },
  });

  const addFileMutation = useMutation({
    mutationFn: async (data: { fileUrl: string; fileName: string; fileRole?: string }) => {
      await apiRequest("POST", `/api/contracts/${id}/files`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/contracts/${id}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/contracts"] });
      toast({ title: "File added" });
    },
  });

  const removeFileMutation = useMutation({
    mutationFn: async (fileId: string) => {
      await apiRequest("DELETE", `/api/contracts/${id}/files`, { fileId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/contracts/${id}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/contracts"] });
      toast({ title: "File removed" });
    },
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "pdf";
      const randomName = `contracts/contract-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const blob = await upload(randomName, file, {
        access: "private",
        handleUploadUrl: "/api/blob/upload",
        clientPayload: JSON.stringify({ type: "contract" }),
      });
      await addFileMutation.mutateAsync({ fileUrl: blob.url, fileName: file.name, fileRole: "appendix" });
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/contracts/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contracts"] });
      setLocation("/contracts");
      toast({ title: "Contract deleted" });
    },
  });

  const linkMutation = useMutation({
    mutationFn: async (licenseId: string) => {
      await apiRequest("POST", `/api/contracts/${id}/licenses`, { licenseId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/contracts/${id}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/contracts"] });
      setLinkOpen(false);
      setSelectedLicense("");
      toast({ title: "License linked" });
    },
  });

  const unlinkMutation = useMutation({
    mutationFn: async (licenseId: string) => {
      await apiRequest("DELETE", `/api/contracts/${id}/licenses`, { licenseId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/contracts/${id}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/contracts"] });
      toast({ title: "License unlinked" });
    },
  });

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(amount);

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-5xl mx-auto">
        <Skeleton className="h-10 w-1/3" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!contract) {
    return (
      <Card className="p-12 text-center max-w-5xl mx-auto">
        <p className="text-muted-foreground mb-4">Contract not found</p>
        <Button onClick={() => setLocation("/contracts")}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Contracts
        </Button>
      </Card>
    );
  }

  // Cost calculation: use explicitly set totalFeeAmount if available and > 0, else sum licenses
  const explicitTotal = contract.totalFeeAmount ? parseFloat(contract.totalFeeAmount) : 0;
  const sumLinked = contract.licenseLinks.reduce((sum, link) => {
    const amt = link.license.licenseFeeAmount ? parseFloat(link.license.licenseFeeAmount) : 0;
    return sum + (isNaN(amt) ? 0 : amt);
  }, 0);

  const totalCost = sumLinked > 0 ? sumLinked : (isNaN(explicitTotal) ? 0 : explicitTotal);

  const totalLinkedContent = contract.licenseLinks.length;
  const existingLicenseIds = contract.licenseLinks.map(l => l.licenseId);
  const availableLicenses = (allLicenses || []).filter(l => !existingLicenseIds.includes(l.id));

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setLocation("/contracts")}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex-1 min-w-[300px]">
            {editing ? (
              <div className="space-y-3">
                <Input value={editData.name} onChange={e => setEditData(p => ({ ...p, name: e.target.value }))} className="text-xl font-bold" />
                <div className="flex gap-2">
                  <Input value={editData.distributor} onChange={e => setEditData(p => ({ ...p, distributor: e.target.value }))} placeholder="Distributor" />
                  <Input value={editData.totalFeeAmount} onChange={e => setEditData(p => ({ ...p, totalFeeAmount: e.target.value }))} placeholder="Total Fee Amount" className="w-[180px]" />
                </div>
              </div>
            ) : (
              <>
                <h1 className="text-2xl font-bold tracking-tight">{contract.name}</h1>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-sm text-muted-foreground">{contract.distributor}</span>
                  {contract.contractMode && <Badge variant="outline" className="text-xs">{contract.contractMode}</Badge>}
                  <Badge variant={contract.status === "verified" ? "secondary" : contract.status === "issue" ? "destructive" : "outline"} className="text-xs">
                    {contract.status}
                  </Badge>
                </div>
              </>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          {editing ? (
            <>
              <Button variant="outline" size="sm" onClick={() => setEditing(false)}>Cancel</Button>
              <Button size="sm" className="gap-2" onClick={() => updateMutation.mutate(editData)} disabled={updateMutation.isPending}>
                {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" size="sm" className="gap-2" onClick={() => setEditing(true)}>
                <Pencil className="w-4 h-4" /> Edit
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2 text-destructive border-destructive/20">
                    <Trash2 className="w-4 h-4" /> Delete
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete this contract?</AlertDialogTitle>
                    <AlertDialogDescription>This will permanently delete "{contract.name}" and unlink all licenses.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => deleteMutation.mutate()} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          )}
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="p-4"><p className="text-2xl font-bold">{totalLinkedContent}</p><p className="text-xs text-muted-foreground">Licenses</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-2xl font-bold font-mono">{formatCurrency(totalCost)}</p><p className="text-xs text-muted-foreground">Total Cost</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-2xl font-bold">{contract.files.length > 0 ? contract.files.length : "No"}</p><p className="text-xs text-muted-foreground">{contract.files.length === 1 ? "File" : "Files"}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-2xl font-bold">{contract.createdAt ? format(new Date(contract.createdAt), "dd MMM yyyy") : "—"}</p><p className="text-xs text-muted-foreground">Created</p></CardContent></Card>
      </div>

      {/* Description & Notes */}
      {editing ? (
        <Card>
          <CardContent className="p-4 space-y-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase">Description</label>
              <Textarea value={editData.description} onChange={e => setEditData(p => ({ ...p, description: e.target.value }))} rows={3} className="mt-1" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase">Notes</label>
              <Textarea value={editData.notes} onChange={e => setEditData(p => ({ ...p, notes: e.target.value }))} rows={3} className="mt-1" />
            </div>
          </CardContent>
        </Card>
      ) : (contract.description || contract.notes) ? (
        <Card>
          <CardContent className="p-4 space-y-3">
            {contract.description && <div><p className="text-xs font-medium text-muted-foreground uppercase mb-1">Description</p><p className="text-sm">{contract.description}</p></div>}
            {contract.notes && <div><p className="text-xs font-medium text-muted-foreground uppercase mb-1">Notes</p><p className="text-sm whitespace-pre-wrap">{contract.notes}</p></div>}
          </CardContent>
        </Card>
      ) : null}

      {/* Shared terms */}
      {contract.sharedTerms && Object.keys(contract.sharedTerms).length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase">Shared Terms</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
              {Object.entries(contract.sharedTerms).map(([key, value]) => (
                <div key={key}>
                  <span className="text-muted-foreground">{key.replace(/_/g, " ")}: </span>
                  <span className="font-medium">{String(value)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Contract files */}
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-medium text-muted-foreground uppercase">Contract Files ({contract.files.length})</CardTitle>
          <div>
            <input type="file" accept=".pdf,.doc,.docx,.txt,.rtf,.odt,.xls,.xlsx,.csv" onChange={handleFileUpload} className="hidden" id="contract-file-upload" />
            <Button variant="outline" size="sm" className="h-8 gap-2" onClick={() => document.getElementById("contract-file-upload")?.click()} disabled={uploading}>
              {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
              {uploading ? "Uploading..." : "Add File"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {contract.files.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2 italic">No files attached to this contract.</p>
          ) : (
            <div className="space-y-1">
              {contract.files.map(file => (
                <div key={file.id} className="group flex items-center justify-between py-2 px-1 rounded hover:bg-muted/30">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                    <a href={`/api/blob/view?url=${encodeURIComponent(file.fileUrl)}`} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline truncate">
                      {file.fileName}
                    </a>
                    {file.fileRole && file.fileRole !== "main" && (
                      <Badge variant="outline" className="text-xs shrink-0">{file.fileRole}</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    {file.notes && <span className="text-xs text-muted-foreground truncate max-w-[200px]">{file.notes}</span>}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => removeFileMutation.mutate(file.id)}
                    >
                      <X className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Linked licenses table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-lg">Linked Licenses ({contract.licenseLinks.length})</CardTitle>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setLinkOpen(true)}>
            <Plus className="w-3.5 h-3.5" /> Link License
          </Button>
        </CardHeader>
        <CardContent className="overflow-x-auto pt-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>License</TableHead>
                <TableHead>Source Title</TableHead>
                <TableHead>Season</TableHead>
                <TableHead>Fee</TableHead>
                <TableHead>Period</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contract.licenseLinks.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-6 text-muted-foreground">No licenses linked yet.</TableCell>
                </TableRow>
              ) : (
                contract.licenseLinks.map(link => {
                  const license = link.license;
                  const fee = license.licenseFeeAmount ? parseFloat(license.licenseFeeAmount) : 0;
                  return (
                    <TableRow key={link.id}>
                      <TableCell>
                        <Link href={`/licenses/${license.id}`} className="text-primary hover:underline font-medium">
                          {license.name}
                        </Link>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                        {link.sourceTitle || (link.sourceTitles ? (Array.isArray(link.sourceTitles) ? link.sourceTitles.join(", ") : String(link.sourceTitles)) : "—")}
                      </TableCell>
                      <TableCell>{license.season || "—"}</TableCell>
                      <TableCell className="font-mono text-sm">{!isNaN(fee) && fee > 0 ? formatCurrency(fee) : "—"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {license.licenseStart && license.licenseEnd
                          ? `${format(new Date(license.licenseStart), "dd-MM-yyyy")} – ${format(new Date(license.licenseEnd), "dd-MM-yyyy")}`
                          : "—"}
                      </TableCell>
                      <TableCell>
                        {link.mappingStatus && link.mappingStatus !== "mapped" && (
                          <Badge variant={link.mappingStatus === "issue" ? "destructive" : "outline"} className="text-xs">
                            {link.mappingStatus}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" className="text-destructive h-7 text-xs" onClick={() => unlinkMutation.mutate(license.id)}>
                          Unlink
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Link License Dialog */}
      <Dialog open={linkOpen} onOpenChange={setLinkOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Link License to Contract</DialogTitle>
          </DialogHeader>
          <Select value={selectedLicense} onValueChange={setSelectedLicense}>
            <SelectTrigger>
              <SelectValue placeholder="Select a license..." />
            </SelectTrigger>
            <SelectContent>
              {availableLicenses.map(l => (
                <SelectItem key={l.id} value={l.id}>
                  {l.name} {l.season ? `(S${l.season})` : ""} — {l.distributor}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLinkOpen(false)}>Cancel</Button>
            <Button disabled={!selectedLicense || linkMutation.isPending} onClick={() => linkMutation.mutate(selectedLicense)}>
              {linkMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Link
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
