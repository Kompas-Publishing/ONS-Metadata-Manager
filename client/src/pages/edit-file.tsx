import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation, useRoute } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { MetadataForm } from "@/components/metadata-form";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { InsertMetadataFile, MetadataFile } from "@shared/schema";
import { isUnauthorizedError } from "@/lib/authUtils";

export default function EditFile() {
  const [, params] = useRoute("/edit/:id");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
    }
  }, [isAuthenticated, authLoading, toast]);

  useEffect(() => {
    if (!authLoading && user && user.canWrite !== 1) {
      toast({
        title: "Permission Denied",
        description: "You don't have permission to edit files.",
        variant: "destructive",
      });
      setLocation(`/view/${params?.id}`);
    }
  }, [authLoading, user, params?.id, toast, setLocation]);

  const { data: file, isLoading } = useQuery<MetadataFile>({
    queryKey: ["/api/metadata", params?.id],
    enabled: !!params?.id && user?.canWrite === 1,
  });

  const { data: adjacent } = useQuery<{ prev: MetadataFile | null; next: MetadataFile | null }>({
    queryKey: ["/api/metadata", params?.id, "adjacent"],
    enabled: !!params?.id && user?.canWrite === 1,
  });

  const updateMutation = useMutation({
    mutationFn: async (data: InsertMetadataFile) => {
      return await apiRequest("PATCH", `/api/metadata/${params?.id}`, data);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Metadata file updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/metadata"] });
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
        description: error.message || "Failed to update file",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (data: InsertMetadataFile) => {
    updateMutation.mutate(data);
  };

  if (authLoading || (user && user.canWrite !== 1)) {
    return (
      <div className="max-w-4xl mx-auto space-y-8">
        <Skeleton className="h-10 w-64" />
        <Card className="p-6">
          <div className="space-y-6">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto space-y-8">
        <Skeleton className="h-10 w-64" />
        <Card className="p-6">
          <div className="space-y-6">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        </Card>
      </div>
    );
  }

  if (!file) {
    return (
      <div className="max-w-4xl mx-auto">
        <Card className="p-12 text-center">
          <p className="text-muted-foreground">File not found</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-semibold text-foreground">Edit Metadata File</h1>
        <p className="text-muted-foreground mt-2">
          Update the metadata for file ID: <span className="font-mono">{file.id}</span>
        </p>
      </div>

      <Card className="p-6">
        <MetadataForm
          defaultValues={{
            title: file.title,
            season: file.season || undefined,
            episode: file.episode || undefined,
            duration: file.duration ?? "",
            breakTime: file.breakTime ?? "",
            breakTimes: file.breakTimes || [],
            endCredits: file.endCredits ?? "",
            description: file.description || "",
            actors: file.actors || [],
            genre: file.genre || [],
            seasonType: (file.seasonType as "Winter" | "Summer" | "Autumn" | "Spring" | undefined) || undefined,
            contentType: file.contentType || "",
            category: (file.category as "Series" | "Movie" | "Documentary" | undefined) || undefined,
            channel: file.channel ?? "ONS",
            programRating: (file.programRating as "AL" | "6" | "9" | "12" | "16" | "18" | undefined) || undefined,
            productionCountry: file.productionCountry ?? "",
            seriesTitle: file.seriesTitle ?? "",
            yearOfProduction: file.yearOfProduction || undefined,
            catchUp: file.catchUp ?? undefined,
            episodeCount: file.episodeCount || undefined,
            episodeTitle: file.episodeTitle ?? "",
            episodeDescription: file.episodeDescription ?? "",
            segmented: file.segmented ?? undefined,
            dateStart: file.dateStart ? new Date(file.dateStart) : undefined,
            dateEnd: file.dateEnd ? new Date(file.dateEnd) : undefined,
            subtitles: file.subtitles ?? undefined,
            subtitlesId: file.subtitlesId ?? "",
            audioId: file.audioId ?? "",
            originalFilename: file.originalFilename ?? "",
            draft: file.draft ?? 0,
          }}
          onSubmit={handleSubmit}
          isPending={updateMutation.isPending}
          submitLabel="Update File"
        />
      </Card>

      {adjacent && (adjacent.prev || adjacent.next) && (
        <Card className="p-6">
          <div className="flex items-center justify-between gap-4">
            <Button
              variant="outline"
              onClick={() => adjacent.prev && setLocation(`/edit/${adjacent.prev.id}`)}
              disabled={!adjacent.prev}
              data-testid="button-previous-episode"
              className="gap-2"
            >
              <ChevronLeft className="w-4 h-4" />
              {adjacent.prev ? (
                <span>
                  Previous Episode
                  {adjacent.prev.episode && ` (${adjacent.prev.episode})`}
                  {adjacent.prev.episodeTitle && `: ${adjacent.prev.episodeTitle}`}
                </span>
              ) : (
                <span>Previous Episode</span>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={() => adjacent.next && setLocation(`/edit/${adjacent.next.id}`)}
              disabled={!adjacent.next}
              data-testid="button-next-episode"
              className="gap-2"
            >
              {adjacent.next ? (
                <span>
                  Next Episode
                  {adjacent.next.episode && ` (${adjacent.next.episode})`}
                  {adjacent.next.episodeTitle && `: ${adjacent.next.episodeTitle}`}
                </span>
              ) : (
                <span>Next Episode</span>
              )}
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
