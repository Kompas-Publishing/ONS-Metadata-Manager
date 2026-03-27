export type MetadataCompleteness = "green" | "orange" | "red";

interface MetadataFields {
  title?: string | null;
  duration?: string | null;
  episode?: number | null;
  contentType?: string | null;
  breakTimes?: string[] | null;
  endCredits?: string | null;
  description?: string | null;
  genre?: string[] | null;
  programRating?: string | null;
  channel?: string | null;
}

export function computeMetadataStatus(file: MetadataFields): MetadataCompleteness {
  // Required fields — RED if missing
  const requiredFilled =
    !!file.title &&
    !!file.duration && file.duration !== "00:00:00" &&
    file.episode != null &&
    !!file.contentType;

  if (!requiredFilled) return "red";

  // Optional fields — ORANGE if any missing
  const optionalFilled =
    (file.breakTimes && file.breakTimes.length > 0) &&
    !!file.description &&
    (file.genre && file.genre.length > 0) &&
    !!file.programRating &&
    !!file.channel;

  if (!optionalFilled) return "orange";

  return "green";
}

export const STATUS_CONFIG = {
  green: { label: "Complete", className: "bg-green-50 text-green-700 border-green-200" },
  orange: { label: "Partial", className: "bg-orange-50 text-orange-700 border-orange-200" },
  red: { label: "Missing", className: "bg-red-50 text-red-700 border-red-200" },
} as const;
