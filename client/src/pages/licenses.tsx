import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  Plus, 
  Loader2, 
  FileText, 
  Calendar as CalendarIcon, 
  CheckCircle2, 
  Search, 
  ArrowUpDown, 
  ArrowUp, 
  ArrowDown,
  Filter
} from "lucide-react";
import { format } from "date-fns";
import type { License } from "@shared/schema";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/hooks/use-auth";
import { useEffect } from "react";

type SortConfig = {
  key: keyof License | "status";
  direction: "asc" | "desc" | null;
};

export default function Licenses() {
  const { canWriteLicenses, canReadLicenses } = useAuth();

  useEffect(() => {
    document.title = "License Manager | ONS Broadcast Portal";
  }, []);

  const { data: licenses, isLoading } = useQuery<License[]>({
    queryKey: ["/api/licenses"],
    enabled: canReadLicenses || canWriteLicenses,
  });

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: "name", direction: "asc" });

  const formatFee = (license: License) => {
    if (!license.licenseFeeAmount) return "-";
    const amount = parseFloat(license.licenseFeeAmount);
    if (isNaN(amount)) return license.licenseFeeAmount;
    
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: license.licenseFeeCurrency || 'EUR',
    }).format(amount);
  };

  const handleSort = (key: keyof License | "status") => {
    let direction: "asc" | "desc" = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });
  };

  const filteredAndSortedLicenses = useMemo(() => {
    if (!licenses) return [];

    return licenses
      .filter((license) => {
        const searchLower = search.toLowerCase();
        const matchesSearch = 
          license.name.toLowerCase().includes(searchLower) ||
          (license.distributor?.toLowerCase() || "").includes(searchLower) ||
          (license.contentTitle?.toLowerCase() || "").includes(searchLower);

        const isExpired = license.licenseEnd && new Date(license.licenseEnd) < new Date();
        const matchesStatus = 
          statusFilter === "all" || 
          (statusFilter === "active" && !isExpired) || 
          (statusFilter === "expired" && isExpired);

        return matchesSearch && matchesStatus;
      })
      .sort((a, b) => {
        if (!sortConfig.direction) return 0;

        let aValue: any;
        let bValue: any;

        if (sortConfig.key === "status") {
          aValue = (a.licenseEnd && new Date(a.licenseEnd) < new Date()) ? "expired" : "active";
          bValue = (b.licenseEnd && new Date(b.licenseEnd) < new Date()) ? "expired" : "active";
        } else if (sortConfig.key === "licenseFeeAmount") {
          // Numerical sort for fees
          aValue = a.licenseFeeAmount ? parseFloat(a.licenseFeeAmount.replace(/[^0-9.-]+/g, "")) : 0;
          bValue = b.licenseFeeAmount ? parseFloat(b.licenseFeeAmount.replace(/[^0-9.-]+/g, "")) : 0;
          if (isNaN(aValue)) aValue = 0;
          if (isNaN(bValue)) bValue = 0;
        } else {
          aValue = a[sortConfig.key as keyof License];
          bValue = b[sortConfig.key as keyof License];
        }

        if (aValue === bValue) return 0;
        if (aValue === null || aValue === undefined) return 1;
        if (bValue === null || bValue === undefined) return -1;

        const comparison = aValue < bValue ? -1 : 1;
        return sortConfig.direction === "asc" ? comparison : -comparison;
      });
  }, [licenses, search, statusFilter, sortConfig]);

  const SortIcon = ({ column }: { column: keyof License | "status" }) => {
    if (sortConfig.key !== column) return <ArrowUpDown className="ml-2 h-4 w-4" />;
    return sortConfig.direction === "asc" ? (
      <ArrowUp className="ml-2 h-4 w-4" />
    ) : (
      <ArrowDown className="ml-2 h-4 w-4" />
    );
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">License Manager</h1>
          <p className="text-muted-foreground mt-2">
            Manage content licenses and contracts
          </p>
        </div>
        {canWriteLicenses && (
          <Link href="/create-license">
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Create License
            </Button>
          </Link>
        )}
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search licenses, distributors, or content..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="w-full md:w-[200px]">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Filter className="h-4 w-4" />
                <SelectValue placeholder="Filter by status" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="expired">Expired</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Licenses ({filteredAndSortedLicenses.length})</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead 
                  className="cursor-pointer hover:text-primary transition-colors"
                  onClick={() => handleSort("name")}
                >
                  <div className="flex items-center">
                    License Name
                    <SortIcon column="name" />
                  </div>
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:text-primary transition-colors"
                  onClick={() => handleSort("distributor")}
                >
                  <div className="flex items-center">
                    Distributor
                    <SortIcon column="distributor" />
                  </div>
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:text-primary transition-colors"
                  onClick={() => handleSort("licenseFeeAmount")}
                >
                  <div className="flex items-center">
                    Fee
                    <SortIcon column="licenseFeeAmount" />
                  </div>
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:text-primary transition-colors"
                  onClick={() => handleSort("licenseStart")}
                >
                  <div className="flex items-center">
                    Start Date
                    <SortIcon column="licenseStart" />
                  </div>
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:text-primary transition-colors"
                  onClick={() => handleSort("licenseEnd")}
                >
                  <div className="flex items-center">
                    End Date
                    <SortIcon column="licenseEnd" />
                  </div>
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:text-primary transition-colors"
                  onClick={() => handleSort("status")}
                >
                  <div className="flex items-center">
                    Status
                    <SortIcon column="status" />
                  </div>
                </TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAndSortedLicenses.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    No matching licenses found.
                  </TableCell>
                </TableRow>
              ) : (
                filteredAndSortedLicenses.map((license) => {
                  const isExpired = license.licenseEnd && new Date(license.licenseEnd) < new Date();
                  
                  return (
                    <TableRow key={license.id}>
                      <TableCell className="font-medium">
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2 text-base">
                            <FileText className="w-4 h-4 text-muted-foreground" />
                            {license.name}
                          </div>
                          {license.contentTitle && license.contentTitle !== license.name && (
                            <span className="text-xs text-muted-foreground ml-6 italic">
                              {license.contentTitle}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-normal capitalize">
                          {license.distributor || "-"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 font-mono">
                          {formatFee(license)}
                          {license.licenseFeePaid === 1 && (
                            <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {license.licenseStart ? (
                          <div className="flex items-center gap-2">
                            <CalendarIcon className="w-3.5 h-3.5 text-muted-foreground" />
                            {format(new Date(license.licenseStart), "dd-MM-yyyy")}
                          </div>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell>
                        {license.licenseEnd ? (
                          <div className="flex items-center gap-2">
                            <CalendarIcon className="w-3.5 h-3.5 text-muted-foreground" />
                            {format(new Date(license.licenseEnd), "dd-MM-yyyy")}
                          </div>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell>
                        {isExpired ? (
                          <Badge variant="destructive" className="w-20 justify-center">Expired</Badge>
                        ) : (
                          <Badge variant="secondary" className="w-20 justify-center bg-green-100 text-green-800 border-green-200">Active</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="outline" size="sm" asChild>
                          <Link href={`/licenses/${license.id}`}>View</Link>
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
    </div>
  );
}