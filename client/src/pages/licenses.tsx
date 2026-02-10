import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
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
import { Plus, Loader2, FileText, Calendar as CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import type { License } from "@shared/schema";
import { Badge } from "@/components/ui/badge";

export default function Licenses() {
  const { data: licenses, isLoading } = useQuery<License[]>({
    queryKey: ["/api/licenses"],
  });

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
        <Link href="/create-license">
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            Create License
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Licenses</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>License Name</TableHead>
                <TableHead>Distributor</TableHead>
                <TableHead>Fee</TableHead>
                <TableHead>End Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {licenses?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No licenses found. Create one to get started.
                  </TableCell>
                </TableRow>
              ) : (
                licenses?.map((license) => {
                  const isExpired = license.licenseEnd && new Date(license.licenseEnd) < new Date();
                  
                  return (
                    <TableRow key={license.id}>
                      <TableCell className="font-medium">
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2">
                            <FileText className="w-4 h-4 text-muted-foreground" />
                            {license.name}
                          </div>
                          {license.contentTitle && (
                            <span className="text-xs text-muted-foreground ml-6">
                              {license.contentTitle}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{license.distributor || "-"}</TableCell>
                      <TableCell>{license.licenseFee || "-"}</TableCell>
                      <TableCell>
                        {license.licenseEnd ? (
                          <div className="flex items-center gap-2">
                            <CalendarIcon className="w-3 h-3 text-muted-foreground" />
                            {format(new Date(license.licenseEnd), "PP")}
                          </div>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell>
                        {isExpired ? (
                          <Badge variant="destructive">Expired</Badge>
                        ) : (
                          <Badge variant="secondary">Active</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" asChild>
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