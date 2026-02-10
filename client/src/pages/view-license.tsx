import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation, useRoute } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowLeft, Trash2, Calendar, FileText, Link as LinkIcon, ExternalLink, Copy, Edit } from "lucide-react";
import { format } from "date-fns";
import type { License } from "@shared/schema";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

export default function ViewLicense() {
  const [, params] = useRoute("/licenses/:id");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const id = params?.id;

  const { data: license, isLoading } = useQuery<License>({
    queryKey: [`/api/licenses/${id}`],
    enabled: !!id,
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/licenses/${id}`);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "License deleted successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/licenses"] });
      setLocation("/licenses");
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete license",
        variant: "destructive",
      });
    },
  });

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied",
      description: "Link copied to clipboard",
    });
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!license) {
    return (
      <div className="flex flex-col items-center justify-center h-full space-y-4">
        <h2 className="text-2xl font-bold">License Not Found</h2>
        <Button asChild>
          <Link href="/licenses">Back to Licenses</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/licenses">
              <ArrowLeft className="w-4 h-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{license.name}</h1>
            {license.contentTitle && (
              <p className="text-muted-foreground mt-1">Content: {license.contentTitle}</p>
            )}
          </div>
        </div>
        
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href={`/licenses/${id}/edit`}>
              <Edit className="w-4 h-4 mr-2" />
              Edit
            </Link>
          </Button>
          
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" className="text-destructive hover:bg-destructive/10">
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. Associated metadata files will lose their association but will NOT be deleted.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => deleteMutation.mutate()} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Info */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Contract Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Rechten (Distributor)</p>
                <p className="text-lg font-semibold">{license.distributor || "-"}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Licentievergoeding (Fee)</p>
                <p className="text-lg font-semibold">{license.licenseFee || "-"}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Aantal runs (Allowed Runs)</p>
                <p className="text-lg font-semibold">{license.allowedRuns || "-"}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Kijkwijzer (Rating)</p>
                <div>
                  {license.contentRating ? (
                    <Badge variant="outline" className="text-base px-3">{license.contentRating}</Badge>
                  ) : (
                    <p className="text-lg font-semibold">-</p>
                  )}
                </div>
              </div>
            </div>

            <Separator />

            <div className="space-y-3">
              <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Omschrijving (Description)</p>
              <p className="text-base whitespace-pre-wrap leading-relaxed">
                {license.description || "No description provided."}
              </p>
            </div>

            <Separator />

            <div className="space-y-3">
              <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Extra Notes</p>
              <p className="text-base italic text-muted-foreground">
                {license.notes || "No additional notes."}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Sidebar Info */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                License Period
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Startdatum</p>
                <p className="text-base font-medium">
                  {license.licenseStart ? format(new Date(license.licenseStart), "PPPP") : "Not set"}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Einddatum</p>
                <p className="text-base font-medium">
                  {license.licenseEnd ? format(new Date(license.licenseEnd), "PPPP") : "Not set"}
                </p>
              </div>
              
              {license.licenseEnd && new Date(license.licenseEnd) < new Date() && (
                <Badge variant="destructive" className="w-full justify-center py-1">Expired</Badge>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <LinkIcon className="w-4 h-4" />
                Links
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">IMDB Link</p>
                {license.imdbLink ? (
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="flex-1" asChild>
                      <a href={license.imdbLink} target="_blank" rel="noopener noreferrer">
                        Open <ExternalLink className="w-3 h-3 ml-2" />
                      </a>
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => copyToClipboard(license.imdbLink!)}>
                      <Copy className="w-3 h-3" />
                    </Button>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground italic">No link provided</p>
                )}
              </div>
            </CardContent>
          </Card>
          
          <div className="px-4 text-[10px] text-muted-foreground uppercase font-mono">
            System ID: {license.id}
          </div>
        </div>
      </div>
    </div>
  );
}