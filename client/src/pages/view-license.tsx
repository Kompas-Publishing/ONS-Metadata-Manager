import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation, useRoute } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowLeft, Trash2 } from "lucide-react";
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
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/licenses">
            <ArrowLeft className="w-4 h-4" />
          </Link>
        </Button>
        <h1 className="text-3xl font-bold tracking-tight">License Details</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{license.name}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-1">
              <h3 className="text-sm font-medium text-muted-foreground">Distributor</h3>
              <p className="text-lg">{license.distributor || "-"}</p>
            </div>
            
            <div className="space-y-1">
              <h3 className="text-sm font-medium text-muted-foreground">Contract Date</h3>
              <p className="text-lg">
                {license.contractDate ? format(new Date(license.contractDate), "PPP") : "-"}
              </p>
            </div>
          </div>

          <div className="space-y-1">
            <h3 className="text-sm font-medium text-muted-foreground">Notes</h3>
            <p className="text-base whitespace-pre-wrap">{license.notes || "-"}</p>
          </div>
        </CardContent>
        <CardFooter className="flex justify-between border-t pt-6">
           <div className="text-sm text-muted-foreground">
             ID: <span className="font-mono">{license.id}</span>
           </div>
           
           <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive">
                <Trash2 className="w-4 h-4 mr-2" />
                Delete License
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. This will permanently delete the license.
                  Associated metadata files will NOT be deleted, but they will lose their license association.
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
        </CardFooter>
      </Card>
    </div>
  );
}
