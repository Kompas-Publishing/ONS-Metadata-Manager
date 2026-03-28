import { useEffect } from "react";
import { FileText } from "lucide-react";

export default function Contracts() {
  useEffect(() => {
    document.title = "Contracts | ONS Broadcast Portal";
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Contracts</h1>
        <p className="text-muted-foreground mt-2">
          Contract management coming soon.
        </p>
      </div>

      <div className="border-2 border-dashed rounded-lg p-16 text-center">
        <FileText className="w-12 h-12 text-muted-foreground/20 mx-auto mb-4" />
        <p className="text-muted-foreground font-medium">This feature is under development</p>
        <p className="text-sm text-muted-foreground mt-1">Contract management will be available here.</p>
      </div>
    </div>
  );
}
