import { useEffect, useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
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
  Plus, Search, FileText, Download, Trash2, ArrowUpDown, ArrowUp, ArrowDown,
  Upload, Loader2, Filter, ArrowLeft,
} from "lucide-react";
import { format } from "date-fns";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { upload } from "@vercel/blob/client";
import type { License } from "@shared/schema";
import { cn } from "@/lib/utils";
import ContractIngestDialog from "@/components/contract-ingest-dialog";

interface ContractListItem {
  id: string;
  name: string;
  distributor: string;
  description: string | null;
  notes: string | null;
  sharedTerms: any;
  createdAt: string | null;
  licenseCount: number;
  fileCount: number;
  totalCost: number;
}

type SortKey = "name" | "distributor" | "licenseCount" | "totalCost";

export default function Contracts() {
  const { canAccessContracts } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [distributorFilter, setDistributorFilter] = useState<string>("all");
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: "asc" | "desc" }>({ key: "distributor", direction: "asc" });
  const [createOpen, setCreateOpen] = useState(false);
  const [ingestOpen, setIngestOpen] = useState(false);

  useEffect(() => {
    document.title = "Contracts | ONS Broadcast Portal";
  }, []);

  const { data: contractsList, isLoading } = useQuery<ContractListItem[]>({
    queryKey: ["/api/contracts"],
    enabled: !!canAccessContracts,
  });

  const distributors = useMemo(() => {
    if (!contractsList) return [];
    return Array.from(new Set(contractsList.map(c => c.distributor))).sort();
  }, [contractsList]);

  const handleSort = (key: SortKey) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));
  };

  const filteredContracts = useMemo(() => {
    if (!contractsList) return [];
    return contractsList
      .filter(c => {
        const q = search.toLowerCase();
        const matchesSearch = c.name.toLowerCase().includes(q) || c.distributor.toLowerCase().includes(q);
        const matchesDistributor = distributorFilter === "all" || c.distributor === distributorFilter;
        return matchesSearch && matchesDistributor;
      })
      .sort((a, b) => {
        const av = a[sortConfig.key];
        const bv = b[sortConfig.key];
        if (av === bv) return 0;
        if (av == null) return 1;
        if (bv == null) return -1;
        const cmp = av < bv ? -1 : 1;
        return sortConfig.direction === "asc" ? cmp : -cmp;
      });
  }, [contractsList, search, distributorFilter, sortConfig]);

  const SortIcon = ({ column }: { column: SortKey }) => {
    if (sortConfig.key !== column) return <ArrowUpDown className="ml-2 h-4 w-4" />;
    return sortConfig.direction === "asc" ? <ArrowUp className="ml-2 h-4 w-4" /> : <ArrowDown className="ml-2 h-4 w-4" />;
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(amount);

  // Create contract state
  const [newContract, setNewContract] = useState({ name: "", distributor: "", contractMode: "", status: "draft", description: "", notes: "", totalFeeAmount: "", totalFeeCurrency: "EUR" });
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
      setNewContract({ name: "", distributor: "", contractMode: "", status: "draft", description: "", notes: "", totalFeeAmount: "", totalFeeCurrency: "EUR" });
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
      toast({ title: "Contract deleted" });
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
      setUploadedFile({ url: blob.url, name: file.name });
      toast({ title: "File uploaded" });
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header — matches License Manager */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Contracts</h1>
          <p className="text-muted-foreground mt-2">
            Manage distributor contracts and linked licenses
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setIngestOpen(true)}>
            <Upload className="w-4 h-4 mr-2" />
            Upload Contract
          </Button>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Add Contract
          </Button>
        </div>
      </div>

      {/* Filters — matches License Manager */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search contracts or distributors..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="w-full md:w-[200px]">
          <Select value={distributorFilter} onValueChange={setDistributorFilter}>
            <SelectTrigger>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Filter className="h-4 w-4" />
                <SelectValue placeholder="Filter by distributor" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Distributors</SelectItem>
              {distributors.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Table — matches License Manager */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Contracts ({filteredContracts.length})</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="cursor-pointer hover:text-primary" onClick={() => handleSort("name")}>
                  <div className="flex items-center">Contract<SortIcon column="name" /></div>
                </TableHead>
                <TableHead className="cursor-pointer hover:text-primary" onClick={() => handleSort("distributor")}>
                  <div className="flex items-center">Distributor<SortIcon column="distributor" /></div>
                </TableHead>
                <TableHead className="cursor-pointer hover:text-primary" onClick={() => handleSort("licenseCount")}>
                  <div className="flex items-center">Licenses<SortIcon column="licenseCount" /></div>
                </TableHead>
                <TableHead className="cursor-pointer hover:text-primary" onClick={() => handleSort("totalCost")}>
                  <div className="flex items-center">Total Cost<SortIcon column="totalCost" /></div>
                </TableHead>
                <TableHead>File</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredContracts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No contracts found.
                  </TableCell>
                </TableRow>
              ) : (
                filteredContracts.map(contract => (
                  <TableRow key={contract.id}>
                    <TableCell className="font-medium">
                      <div className="flex flex-col">
                        <Link href={`/contracts/${contract.id}`} className="text-primary hover:underline">
                          {contract.name}
                        </Link>
                        {contract.description && (
                          <span className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{contract.description}</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-normal">{contract.distributor}</Badge>
                    </TableCell>
                    <TableCell>{contract.licenseCount}</TableCell>
                    <TableCell className="font-mono">{formatCurrency(contract.totalCost)}</TableCell>
                    <TableCell>
                      {contract.fileCount > 0 ? (
                        <Link href={`/contracts/${contract.id}`} className="flex items-center gap-1.5 text-xs text-primary hover:underline">
                          <FileText className="w-3.5 h-3.5" />
                          {contract.fileCount} {contract.fileCount === 1 ? 'file' : 'files'}
                        </Link>
                      ) : (
                        <span className="text-xs text-muted-foreground">No files</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="outline" size="sm" asChild>
                          <Link href={`/contracts/${contract.id}`}>View</Link>
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive">
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
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
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Ingest Dialog */}
      <ContractIngestDialog open={ingestOpen} onOpenChange={setIngestOpen} />

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Contract</DialogTitle>
            <DialogDescription>Create a new contract entry with optional file upload.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Contract Name *</label>
                <Input
                  value={newContract.name}
                  onChange={e => setNewContract(p => ({ ...p, name: e.target.value }))}
                  placeholder="BBC - December Package (2024)"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Distributor *</label>
                <Input
                  value={newContract.distributor}
                  onChange={e => setNewContract(p => ({ ...p, distributor: e.target.value }))}
                  placeholder="BBC Studios"
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Mode</label>
                <Select value={newContract.contractMode} onValueChange={v => setNewContract(p => ({ ...p, contractMode: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="split">Split</SelectItem>
                    <SelectItem value="umbrella">Umbrella</SelectItem>
                    <SelectItem value="mixed">Mixed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Total Fee</label>
                <Input
                  value={newContract.totalFeeAmount}
                  onChange={e => setNewContract(p => ({ ...p, totalFeeAmount: e.target.value }))}
                  placeholder="8375.00"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Currency</label>
                <Select value={newContract.totalFeeCurrency} onValueChange={v => setNewContract(p => ({ ...p, totalFeeCurrency: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="EUR">EUR</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="GBP">GBP</SelectItem>
                  </SelectContent>
                </Select>
              </div>
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
              <label className="text-sm font-medium">Contract File</label>
              {uploadedFile ? (
                <div className="flex items-center gap-2 p-2 bg-muted/50 rounded text-sm">
                  <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span className="truncate flex-1">{uploadedFile.name}</span>
                  <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setUploadedFile(null)}>Remove</Button>
                </div>
              ) : (
                <>
                  <input type="file" accept=".pdf,.doc,.docx,.txt,.rtf,.odt,.xls,.xlsx,.csv" onChange={handleFileUpload} className="hidden" id="contract-upload" />
                  <Button variant="outline" size="sm" className="gap-2" onClick={() => document.getElementById("contract-upload")?.click()} disabled={uploading}>
                    {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                    {uploading ? "Uploading..." : "Upload File"}
                  </Button>
                </>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button
              onClick={() => createMutation.mutate({
                ...newContract,
                fileUrl: uploadedFile?.url,
                fileName: uploadedFile?.name,
              })}
              disabled={!newContract.name || !newContract.distributor || createMutation.isPending}
            >
              {createMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Create Contract
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
