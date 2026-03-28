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
import { ArrowLeft, Download, Plus, Trash2, Pencil, Save, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { License } from "@shared/schema";
import { cn } from "@/lib/utils";

interface ContractDetail {
  id: string;
  name: string;
  distributor: string;
  description: string | null;
  notes: string | null;
  fileUrl: string | null;
  fileName: string | null;
  sharedTerms: any;
  createdAt: string | null;
  licenses: License[];
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
  const [editData, setEditData] = useState({ name: "", distributor: "", description: "", notes: "" });
  const [linkOpen, setLinkOpen] = useState(false);
  const [selectedLicense, setSelectedLicense] = useState("");

  useEffect(() => {
    if (contract) {
      setEditData({
        name: contract.name,
        distributor: contract.distributor,
        description: contract.description || "",
        notes: contract.notes || "",
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

  const totalCost = contract.licenses.reduce((sum, l) => {
    const amt = l.licenseFeeAmount ? parseFloat(l.licenseFeeAmount) : 0;
    return sum + (isNaN(amt) ? 0 : amt);
  }, 0);

  const totalLinkedContent = contract.licenses.length;
  const existingLicenseIds = contract.licenses.map(l => l.id);
  const availableLicenses = (allLicenses || []).filter(l => !existingLicenseIds.includes(l.id));

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setLocation("/contracts")}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            {editing ? (
              <div className="space-y-2">
                <Input value={editData.name} onChange={e => setEditData(p => ({ ...p, name: e.target.value }))} className="text-xl font-bold" />
                <Input value={editData.distributor} onChange={e => setEditData(p => ({ ...p, distributor: e.target.value }))} placeholder="Distributor" />
              </div>
            ) : (
              <>
                <h1 className="text-2xl font-bold tracking-tight">{contract.name}</h1>
                <p className="text-sm text-muted-foreground">{contract.distributor}</p>
              </>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          {contract.fileUrl && (
            <a href={`/api/blob/view?url=${encodeURIComponent(contract.fileUrl)}`} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="sm" className="gap-2">
                <Download className="w-4 h-4" />
                Download
              </Button>
            </a>
          )}
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
        <Card><CardContent className="p-4"><p className="text-2xl font-bold">{contract.fileUrl ? "Yes" : "No"}</p><p className="text-xs text-muted-foreground">File Attached</p></CardContent></Card>
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

      {/* Linked licenses table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-lg">Linked Licenses ({contract.licenses.length})</CardTitle>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setLinkOpen(true)}>
            <Plus className="w-3.5 h-3.5" /> Link License
          </Button>
        </CardHeader>
        <CardContent className="overflow-x-auto pt-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>License Name</TableHead>
                <TableHead>Season</TableHead>
                <TableHead>Distributor</TableHead>
                <TableHead>Fee</TableHead>
                <TableHead>Period</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contract.licenses.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-6 text-muted-foreground">No licenses linked yet.</TableCell>
                </TableRow>
              ) : (
                contract.licenses.map(license => {
                  const fee = license.licenseFeeAmount ? parseFloat(license.licenseFeeAmount) : 0;
                  return (
                    <TableRow key={license.id}>
                      <TableCell>
                        <Link href={`/licenses/${license.id}`} className="text-primary hover:underline font-medium">
                          {license.name}
                        </Link>
                        {license.contentTitle && license.contentTitle !== license.name && (
                          <span className="text-xs text-muted-foreground ml-2">{license.contentTitle}</span>
                        )}
                      </TableCell>
                      <TableCell>{license.season || "—"}</TableCell>
                      <TableCell><Badge variant="outline" className="font-normal">{license.distributor || "—"}</Badge></TableCell>
                      <TableCell className="font-mono">{!isNaN(fee) && fee > 0 ? formatCurrency(fee) : "—"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {license.licenseStart && license.licenseEnd
                          ? `${format(new Date(license.licenseStart), "dd-MM-yyyy")} – ${format(new Date(license.licenseEnd), "dd-MM-yyyy")}`
                          : "—"}
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
