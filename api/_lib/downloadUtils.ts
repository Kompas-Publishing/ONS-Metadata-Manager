import * as XLSX from "xlsx";

export function transformFileForDownload(file: any): any {
  // Convert booleans to True/False strings
  const boolToString = (val: any) => {
    if (val === null || val === undefined) return null;
    return val === 1 || val === true ? "True" : "False";
  };

  return {
    // Identification
    id: file.id,
    channel: file.channel ?? null,
    category: file.category ?? null,
    contentType: file.contentType ?? null,
    seasonType: file.seasonType ?? null,
    productionCountry: file.productionCountry ?? null,
    yearOfProduction: file.yearOfProduction ?? null,
    programRating: file.programRating ?? null,

    // Titles
    title: file.title ?? null,
    seriesTitle: file.seriesTitle ?? null,
    episodeTitle: file.episodeTitle ?? null,

    // Description
    description: file.description ?? null,
    episodeDescription: file.episodeDescription ?? null,

    // Season/Episode
    season: file.season ?? null,
    episode: file.episode ?? null,

    // Time / Runtime
    duration: file.duration ?? null,
    breakTime:
      file.breakTime ??
      (Array.isArray(file.breakTimes) && file.breakTimes.length > 0
        ? file.breakTimes[0]
        : null),
    breakTimes: Array.isArray(file.breakTimes) ? file.breakTimes : [],
    endCredits: file.endCredits ?? null,
    dateStart: file.dateStart ? file.dateStart.toISOString() : null,
    dateEnd: file.dateEnd ? file.dateEnd.toISOString() : null,

    // People
    actors: file.actors || [],

    // Genre
    genre: file.genre || [],

    // Tags
    tags: file.tags || [],

    // Technical flags
    audioId: file.audioId ?? null,
    originalFilename: file.originalFilename ?? null,
    catchUp: boolToString(file.catchUp),
    segmented: boolToString(file.segmented),
    subtitles: boolToString(file.subtitles),
    subtitlesId: file.subtitlesId ?? null,

    // Timestamps
    createdAt: file.createdAt ? file.createdAt.toISOString() : null,
  };
}

export function buildItemXml(file: any, itemElement: any) {
  const actors = Array.isArray(file.actors) ? file.actors : [];
  const genre = Array.isArray(file.genre) ? file.genre : [];
  const tags = Array.isArray(file.tags) ? file.tags : [];
  const breakTimes = Array.isArray(file.breakTimes) ? file.breakTimes : [];

  // Identification section
  itemElement.com(' Identification ');
  itemElement.ele('id').txt(file.id || '').up();
  itemElement.ele('channel').txt(file.channel || '').up();
  itemElement.ele('category').txt(file.category || '').up();
  itemElement.ele('contentType').txt(file.contentType || '').up();
  itemElement.ele('seasonType').txt(file.seasonType || '').up();
  itemElement.ele('productionCountry').txt(file.productionCountry || '').up();
  itemElement.ele('yearOfProduction').txt(file.yearOfProduction || '').up();
  itemElement.ele('programRating').txt(file.programRating || '').up();

  // Titles section
  itemElement.com(' Titles ');
  itemElement.ele('title').txt(file.title || '').up();
  itemElement.ele('seriesTitle').txt(file.seriesTitle || '').up();
  itemElement.ele('episodeTitle').txt(file.episodeTitle || '').up();

  // Description section
  itemElement.com(' Description ');
  itemElement.ele('description').txt(file.description || '').up();
  itemElement.ele('episodeDescription').txt(file.episodeDescription || '').up();

  // Season/Episode section
  itemElement.com(' Season/Episode ');
  itemElement.ele('season').txt(file.season || '').up();
  itemElement.ele('episode').txt(file.episode || '').up();

  // Time/Runtime section
  itemElement.com(' Time/Runtime ');
  itemElement.ele('duration').txt(file.duration || '').up();
  itemElement.ele('breakTime').txt(file.breakTime || '').up();

  // Add breakTimes array if present
  if (breakTimes.length > 0) {
    const breakTimesEle = itemElement.ele('breakTimes');
    breakTimes.forEach((time: string) => {
      breakTimesEle.ele('breakTime').txt(time).up();
    });
    breakTimesEle.up();
  }

  itemElement.ele('endCredits').txt(file.endCredits || '').up();
  itemElement.ele('dateStart').txt(file.dateStart || '').up();
  itemElement.ele('dateEnd').txt(file.dateEnd || '').up();

  // People section
  itemElement.com(' People ');
  if (actors.length > 0) {
    const actorsEle = itemElement.ele('actors');
    actors.forEach((actor: string) => {
      actorsEle.ele('actor').txt(actor).up();
    });
    actorsEle.up();
  }

  // Genre section
  itemElement.com(' Genre ');
  if (genre.length > 0) {
    const genreEle = itemElement.ele('genre');
    genre.forEach((g: string) => {
      genreEle.ele('item').txt(g).up();
    });
    genreEle.up();
  }

  // Tags section
  itemElement.com(' Tags ');
  if (tags.length > 0) {
    const tagsEle = itemElement.ele('tags');
    tags.forEach((tag: string) => {
      tagsEle.ele('tag').txt(tag).up();
    });
    tagsEle.up();
  }

  // Technical section
  itemElement.com(' Technical ');
  itemElement.ele('audioId').txt(file.audioId || '').up();
  itemElement.ele('originalFilename').txt(file.originalFilename || '').up();
  itemElement.ele('catchUp').txt(file.catchUp || '').up();
  itemElement.ele('segmented').txt(file.segmented || '').up();
  itemElement.ele('subtitles').txt(file.subtitles || '').up();
  itemElement.ele('subtitlesId').txt(file.subtitlesId || '').up();

  // Timestamps section
  itemElement.com(' Timestamps ');
  itemElement.ele('createdAt').txt(file.createdAt || '').up();
}

export async function buildMetadataXml(file: any): Promise<string> {
  const { create } = await import("xmlbuilder2");
  const doc = create({ version: '1.0' });
  const metadata = doc.ele('metadata');
  const item = metadata.ele('item');
  buildItemXml(file, item);
  return doc.end({ prettyPrint: true });
}

export async function buildSeriesXml(files: any[], rootElementName: string = 'series'): Promise<string> {
  const { create } = await import("xmlbuilder2");
  const root = create({ version: '1.0' }).ele(rootElementName);
  files.forEach(file => {
    const item = root.ele('item');
    buildItemXml(file, item);
    item.up();
  });
  return root.end({ prettyPrint: true });
}

function transformFileToXlsxRow(file: any, maxBreakTimes: number = 0): any[] {
  const breakTimes = Array.isArray(file.breakTimes) ? file.breakTimes : [];
  const genre = Array.isArray(file.genre) ? file.genre.join(" | ") : (file.genre || "");
  const tags = Array.isArray(file.tags) ? file.tags.join(" | ") : (file.tags || "");
  const actors = Array.isArray(file.actors) ? file.actors.join(" | ") : (file.actors || "");

  const toYesNo = (val: any) => {
    if (val === null || val === undefined) return "";
    if (val === 1 || val === true || val === "True") return "yes";
    if (val === 0 || val === false || val === "False") return "no";
    return val;
  };

  const formatDate = (date: any) => {
    if (!date) return "";
    const d = new Date(date);
    if (isNaN(d.getTime())) return "";
    return d.toISOString().split('T')[0];
  };

  const row = [
    file.channel || "",
    file.originalFilename || "",
    "",
    file.id || "",
    file.title || "",
    file.description || "",
    genre,
    file.programRating || "",
    file.productionCountry || "",
    file.season ? "yes" : "no",
    file.seriesTitle || "",
    file.yearOfProduction || "",
    toYesNo(file.catchUp),
    file.season || "",
    file.episodeCount || "",
    file.episodeTitle || "",
    file.episode || "",
    file.episodeDescription || "",
    file.duration || "",
    formatDate(file.dateStart),
    formatDate(file.dateEnd),
    toYesNo(file.subtitles),
    file.subtitlesId || "",
    toYesNo(file.segmented),
    file.contentType || "",
  ];

  for (let i = 0; i < maxBreakTimes; i++) {
    row.push(breakTimes[i] || "");
  }

  row.push(tags);
  row.push(file.audioId || "");
  row.push(file.category || "");
  row.push(file.seasonType || "");
  row.push(file.endCredits || "");
  row.push(actors);

  const TEMPLATE_TOTAL_COLUMNS = 104;
  const currentLength = row.length;

  for (let i = currentLength; i < TEMPLATE_TOTAL_COLUMNS; i++) {
    row.push("");
  }

  return row;
}

export function buildMetadataXlsx(files: any[]): XLSX.WorkBook {
  const maxBreakTimes = files.reduce((max, file) => {
    const breakTimesCount = Array.isArray(file.breakTimes) ? file.breakTimes.length : 0;
    return Math.max(max, breakTimesCount);
  }, 0);

  const headers = [
    "Channel",
    "Original filename",
    "Original thumb filename",
    "Original ID",
    "Title",
    "Description nl",
    "Genre",
    "Program rating",
    "Production country",
    "Serie",
    "Series title nl",
    "Year of production",
    "CatchUp",
    "Season",
    "Number of episodes",
    "Episode title",
    "Episode number",
    "Episode description",
    "Duration",
    "Start datetime",
    "End datetime",
    "subtitles",
    "Subtitles ID",
    "Segmented",
    "Content type",
  ];

  for (let i = 0; i < maxBreakTimes; i++) {
    headers.push(i === 0 ? "Timecodes" : "");
  }

  headers.push("Tags");
  headers.push("Audio ID");
  headers.push("Category");
  headers.push("Season Type");
  headers.push("End Credits");
  headers.push("Actors");

  const TEMPLATE_TOTAL_COLUMNS = 104;
  while (headers.length < TEMPLATE_TOTAL_COLUMNS) {
    headers.push("");
  }

  const rows = files.map(file => transformFileToXlsxRow(file, maxBreakTimes));
  const data = [headers, ...rows];
  const ws = XLSX.utils.aoa_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Worksheet");

  return wb;
}
