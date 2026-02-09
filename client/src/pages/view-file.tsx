import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation, useRoute } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { MetadataForm } from "@/components/metadata-form";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Download, ChevronLeft } from "lucide-react";
import type { MetadataFile } from "@shared/schema";

export default function ViewFile() {
  const [, params] = useRoute("/view/:id");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
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
    if (!authLoading && user && user.canRead !== 1 && user.canWrite !== 1) {
      toast({
        title: "Permission Denied",
        description: "You don't have permission to view files.",
        variant: "destructive",
      });
      setLocation("/");
    }
  }, [authLoading, user, toast, setLocation]);

  const { data: file, isLoading } = useQuery<MetadataFile>({
    queryKey: ["/api/metadata", params?.id],
    enabled: !!params?.id && (user?.canRead === 1 || user?.canWrite === 1),
  });

  const handleDownload = async (format: "json" | "xml" | "xlsx") => {
    try {
      const response = await fetch(`/api/metadata/${params?.id}/download?format=${format}`);
      if (!response.ok) throw new Error("Download failed");
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${params?.id}.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({
        title: "Success",
        description: `File downloaded as ${format.toUpperCase()}`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to download file",
        variant: "destructive",
      });
    }
  };

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-foreground">View Metadata File</h1>
          <p className="text-muted-foreground mt-2">
            File ID: <span className="font-mono">{file.id}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => handleDownload("xml")}
            data-testid="button-download-xml"
          >
            <Download className="w-4 h-4 mr-2" />
            Download XML
          </Button>
          <Button
            variant="outline"
            onClick={() => handleDownload("xlsx")}
            data-testid="button-download-xlsx"
          >
            <Download className="w-4 h-4 mr-2" />
            Download XLSX
          </Button>
          <Button
            variant="outline"
            onClick={() => setLocation("/all-files")}
            data-testid="button-back"
          >
            <ChevronLeft className="w-4 h-4 mr-2" />
            Back to Files
          </Button>
        </div>
      </div>

      <Card className="p-6">
        <MetadataForm
          lastAired={file.lastAired}
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
            tags: file.tags || [],
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
          }}
          onSubmit={() => {}}
          isPending={false}
          submitLabel="Save"
          readOnly={true}
        />
      </Card>
    </div>
  );
}
