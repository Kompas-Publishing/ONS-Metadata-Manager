export type MetadataCompleteness = "complete" | "incomplete";

interface MetadataFields {
  title?: string | null;
  duration?: string | null;
  episode?: number | null;
  contentType?: string | null;
  channel?: string | null;
}

export function computeMetadataStatus(file: MetadataFields): MetadataCompleteness {
  const requiredFilled =
    !!file.title &&
    !!file.duration && file.duration !== "00:00:00" &&
    file.episode != null &&
    !!file.contentType &&
    !!file.channel;

  return requiredFilled ? "complete" : "incomplete";
}

export const STATUS_CONFIG = {
  complete: { label: "Complete", className: "bg-green-50 text-green-700 border-green-200" },
  incomplete: { label: "Incomplete", className: "bg-red-50 text-red-700 border-red-200" },
} as const;
