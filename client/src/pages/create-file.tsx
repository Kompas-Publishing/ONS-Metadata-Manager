import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { MetadataForm } from "@/components/metadata-form";
import { Card } from "@/components/ui/card";
import type { InsertMetadataFile } from "@shared/schema";
import { isUnauthorizedError } from "@/lib/authUtils";

export default function CreateFile() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: nextId } = useQuery<string>({
    queryKey: ["/api/metadata/next-id"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: InsertMetadataFile) => {
      return await apiRequest("POST", "/api/metadata", data);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Metadata file created successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/metadata"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      setLocation("/");
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: error.message || "Failed to create file",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (data: InsertMetadataFile) => {
    createMutation.mutate(data);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-semibold text-foreground">Create Metadata File</h1>
        <p className="text-muted-foreground mt-2">
          Create a single metadata file with a unique auto-generated ID
        </p>
      </div>

      <Card className="p-6">
        <MetadataForm
          onSubmit={handleSubmit}
          isPending={createMutation.isPending}
          submitLabel="Create File"
          generatedId={nextId}
        />
      </Card>
    </div>
  );
}
