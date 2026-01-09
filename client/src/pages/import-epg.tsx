import { useState, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Upload, CheckCircle, AlertCircle, FileText, Play } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";

interface EpgItem {
  channel: string;
  start_datetime: string;
  end_datetime: string;
  title: string;
  description_nl: string;
  genre: string;
  content_type: string;
  category: string;
  duration: number; // seconds
  series: string; // "Yes" | "No"
  season?: number;
  episode_number?: number;
  episode_title?: string;
  catchup?: number;
  production_year?: number;
}

interface ProcessedItem {
  title: string;
  description?: string;
  genre?: string[];
  duration: string; // HH:MM:SS
  category: "Series" | "Movie" | "Documentary";
  contentType: string;
  season?: number;
  episode?: number;
  episodeTitle?: string;
  channel?: string;
  catchUp?: number;
  yearOfProduction?: number;
  lastAired?: string;
  isEpgGenerated: number;
}

export default function ImportEpg() {
  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [parsedItems, setParsedItems] = useState<ProcessedItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stats, setStats] = useState<{ created: number; updated: number; errors: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setParsedItems([]);
      setStats(null);
      setProgress(0);
    }
  };

  const parseXML = async () => {
    if (!file) return;

    setParsing(true);
    try {
      const text = await file.text();
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(text, "text/xml");
      
      const programmes = xmlDoc.getElementsByTagName("programme");
      const items: ProcessedItem[] = [];

      for (let i = 0; i < programmes.length; i++) {
        const prog = programmes[i];
        
        const getText = (tag: string) => prog.getElementsByTagName(tag)[0]?.textContent || "";
        
        const durationSec = parseInt(getText("duration") || "0");
        const hours = Math.floor(durationSec / 3600);
        const minutes = Math.floor((durationSec % 3600) / 60);
        const seconds = durationSec % 60;
        const durationStr = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

        const isSeries = getText("series").toLowerCase() === "yes";
        const genreStr = getText("genre");
        const genres = genreStr ? genreStr.split("/").map(g => g.trim()) : [];
        
        // Skip Animation
        if (genres.some(g => g.toLowerCase().includes("animation") || g.toLowerCase().includes("animatie"))) {
          continue;
        }
        
        // Determine category
        let category: "Series" | "Movie" | "Documentary" = "Movie"; // Default
        if (isSeries) category = "Series";
        else if (genres.some(g => g.toLowerCase().includes("documentaire"))) category = "Documentary";

        items.push({
          title: getText("title"),
          description: getText("description_nl"),
          genre: genres,
          duration: durationStr,
          category,
          contentType: getText("content_type") || "program",
          season: getText("season") ? parseInt(getText("season")) : undefined,
          episode: getText("episode_number") ? parseInt(getText("episode_number")) : undefined,
          episodeTitle: getText("episode_title"),
          channel: getText("channel"),
          catchUp: getText("catchup") === "1" ? 1 : 0,
          yearOfProduction: getText("production_year") ? parseInt(getText("production_year")) : undefined,
          lastAired: getText("start_datetime") ? new Date(getText("start_datetime").replace(" ", "T")).toISOString() : undefined,
          isEpgGenerated: 1
        });
      }

      setParsedItems(items);
      toast({
        title: "Parsing Complete",
        description: `Successfully parsed ${items.length} items. Ready to import.`,
      });
    } catch (error) {
      console.error("Parse error:", error);
      toast({
        title: "Error Parsing XML",
        description: "Failed to parse the EPG file. Please check the format.",
        variant: "destructive",
      });
    } finally {
      setParsing(false);
    }
  };

  const uploadBatch = async () => {
    if (parsedItems.length === 0) return;

    setUploading(true);
    setProgress(0);
    const BATCH_SIZE = 50;
    const totalBatches = Math.ceil(parsedItems.length / BATCH_SIZE);
    
    let totalCreated = 0;
    let totalUpdated = 0;
    let totalErrors = 0;

    for (let i = 0; i < totalBatches; i++) {
      const batch = parsedItems.slice(i * BATCH_SIZE, (i + 1) * BATCH_SIZE);
      
      try {
        const res = await apiRequest("POST", "/api/epg/batch-import", { items: batch });
        const batchStats = await res.json();
        
        totalCreated += batchStats.created;
        totalUpdated += batchStats.updated;
        totalErrors += batchStats.errors;
        
        setProgress(Math.round(((i + 1) / totalBatches) * 100));
      } catch (error) {
        console.error("Batch upload error:", error);
        totalErrors += batch.length;
        // Continue with next batch even if one fails
      }
    }

    setStats({ created: totalCreated, updated: totalUpdated, errors: totalErrors });
    setUploading(false);
    toast({
      title: "Import Complete",
      description: `Created: ${totalCreated}, Updated: ${totalUpdated}, Errors: ${totalErrors}`,
    });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-semibold text-foreground">Import EPG</h1>
        <p className="text-muted-foreground mt-2">
          Upload an XML EPG file to auto-generate or update metadata.
        </p>
      </div>

      <Card className="p-8">
        <div className="flex flex-col items-center justify-center space-y-4 border-2 border-dashed border-muted rounded-lg p-12 bg-muted/10">
          <Upload className="w-12 h-12 text-muted-foreground" />
          <div className="text-center">
            <p className="text-lg font-medium">
              {file ? file.name : "Drag and drop or click to select"}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Supports .xml files (max 10MB)
            </p>
          </div>
          <input
            type="file"
            accept=".xml"
            className="hidden"
            ref={fileInputRef}
            onChange={handleFileChange}
          />
          <Button 
            variant="secondary" 
            onClick={() => fileInputRef.current?.click()}
            disabled={parsing || uploading}
          >
            Select File
          </Button>
        </div>

        {file && !parsedItems.length && (
          <div className="mt-6 flex justify-end">
            <Button onClick={parseXML} disabled={parsing}>
              {parsing ? "Parsing..." : "Parse XML"}
            </Button>
          </div>
        )}

        {parsedItems.length > 0 && !stats && (
          <div className="mt-8 space-y-6">
            <div className="flex items-center justify-between p-4 bg-primary/5 rounded-lg border border-primary/20">
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-primary" />
                <span className="font-medium">{parsedItems.length} items ready to import</span>
              </div>
              <Button onClick={uploadBatch} disabled={uploading}>
                {uploading ? (
                  <>Processing... {progress}%</>
                ) : (
                  <>
                    <Play className="w-4 h-4 mr-2" />
                    Start Import
                  </>
                )}
              </Button>
            </div>
            
            {uploading && (
              <Progress value={progress} className="h-2" />
            )}

            <div className="border rounded-md overflow-hidden max-h-96 overflow-y-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-muted text-muted-foreground sticky top-0">
                  <tr>
                    <th className="p-3 font-medium">Title</th>
                    <th className="p-3 font-medium">Episode</th>
                    <th className="p-3 font-medium">Duration</th>
                    <th className="p-3 font-medium">Category</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {parsedItems.slice(0, 100).map((item, i) => (
                    <tr key={i} className="hover:bg-muted/50">
                      <td className="p-3">{item.title}</td>
                      <td className="p-3">
                        {item.season ? `S${item.season}` : ''}
                        {item.episode ? `E${item.episode}` : ''}
                        {item.episodeTitle ? ` - ${item.episodeTitle}` : ''}
                      </td>
                      <td className="p-3 font-mono text-xs">{item.duration}</td>
                      <td className="p-3">{item.category}</td>
                    </tr>
                  ))}
                  {parsedItems.length > 100 && (
                    <tr>
                      <td colSpan={4} className="p-3 text-center text-muted-foreground">
                        ... and {parsedItems.length - 100} more
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {stats && (
          <div className="mt-8 space-y-6">
            <Alert className="bg-green-50 border-green-200">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertTitle className="text-green-800">Import Completed</AlertTitle>
              <AlertDescription className="text-green-700">
                Processed {parsedItems.length} items successfully.
              </AlertDescription>
            </Alert>
            
            <div className="grid grid-cols-3 gap-4">
              <Card className="p-4 flex flex-col items-center">
                <span className="text-2xl font-bold text-green-600">{stats.created}</span>
                <span className="text-sm text-muted-foreground">New Files Created</span>
              </Card>
              <Card className="p-4 flex flex-col items-center">
                <span className="text-2xl font-bold text-blue-600">{stats.updated}</span>
                <span className="text-sm text-muted-foreground">Files Updated</span>
              </Card>
              <Card className="p-4 flex flex-col items-center">
                <span className="text-2xl font-bold text-red-600">{stats.errors}</span>
                <span className="text-sm text-muted-foreground">Errors</span>
              </Card>
            </div>

            <div className="flex justify-end">
              <Button variant="outline" onClick={() => {
                setFile(null);
                setParsedItems([]);
                setStats(null);
              }}>
                Import Another File
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
