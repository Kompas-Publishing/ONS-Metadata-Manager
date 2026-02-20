import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { MetadataForm } from "@/components/metadata-form";
import { Card } from "@/components/ui/card";
import type { InsertMetadataFile } from "@shared/schema";
import { isUnauthorizedError } from "@/lib/authUtils";
import { useAuth } from "@/hooks/use-auth";
import { useEffect } from "react";

export default function CreateFile() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { canWriteMetadata } = useAuth();

  useEffect(() => {
    document.title = "Create Metadata | ONS Broadcast Portal";
  }, []);

  const { data: nextId } = useQuery<string>({
    queryKey: ["/api/metadata/next-id"],
    enabled: canWriteMetadata,
  });

  const createMutation = useMutation({
    mutationFn: async (data: InsertMetadataFile) => {
      return await apiRequest("POST", "/api/metadata", data);
    },
    onSuccess: (_, variables) => {
      const isDraft = variables.draft === 1;
      toast({
        title: "Success",
        description: isDraft
          ? "Draft saved successfully"
          : "Metadata file created successfully",
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
    createMutation.mutate({ ...data, draft: 0 });
  };

  const handleSaveDraft = (data: InsertMetadataFile) => {
    createMutation.mutate({ ...data, draft: 1 });
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
          onSaveDraft={handleSaveDraft}
          isPending={createMutation.isPending}
          submitLabel="Create File"
          generatedId={nextId}
        />
      </Card>
    </div>
  );
}
