export type ShotSectionData = {
  heading: string;
  content: string;
  copyContent: string;
};

export type ParsedShotSections = {
  prefix: string;
  sections: ShotSectionData[];
};

const DELIMITER_PATTERN = /^\s*---\s*$/gm;
const MANIFEST_PATTERN = /^UPLOAD MANIFEST\b/gim;
const SHOT_TYPE_PATTERN = /Shot\s+type\s*&\s*primary\s+reference/i;

function normalizeContent(content: string) {
  return content
    .replace(/^\s*```(?:text|markdown)?\s*\r?\n/i, "")
    .replace(/\r?\n```\s*$/i, "")
    .trim();
}

function headingMatches(content: string) {
  const matches: Array<{ index: number; source: string; heading: string; number: number }> = [];
  const linePattern = /^.*$/gm;
  for (const line of content.matchAll(linePattern)) {
    const trimmed = line[0].trim();
    const match = trimmed.match(
      /^(?:#{1,6}\s+)?(?:★\s*)?(?:={3,}\s*)?Shot\s*#?\s*(\d+)\b(?:\s*(?:[-—:•]\s*)(.*?))?\s*(?:={3,})?$/i,
    );
    if (!match) continue;
    const number = Number(match[1]);
    const description = match[2]?.replace(/\s*=+\s*$/, "").trim();
    matches.push({
      index: line.index ?? 0,
      source: line[0],
      heading: description ? `Shot ${number} — ${description}` : `Shot ${number}`,
      number,
    });
  }
  return matches;
}

function hasStrictlyIncreasingNumbers(matches: ReturnType<typeof headingMatches>) {
  return matches.every((match, index) => index === 0 || match.number > matches[index - 1].number);
}

function parseExplicitHeadings(content: string): ParsedShotSections | null {
  const matches = headingMatches(content);
  if (matches.length < 2 || !hasStrictlyIncreasingNumbers(matches)) return null;

  const sections = matches.map((match, index) => {
    const contentStart = match.index + match.source.length;
    const end = index + 1 < matches.length ? matches[index + 1].index : content.length;
    const body = content
      .slice(contentStart, end)
      .replace(/^\s*(?:(?:-{3,}|={3,})\s*)?/, "")
      .replace(/\s*(?:-{3,}|={3,})\s*$/, "")
      .trim();
    return {
      heading: match.heading,
      content: body,
      copyContent: `${match.heading}\n\n${body}`.trim(),
    };
  });
  return { prefix: content.slice(0, matches[0].index).trim(), sections };
}

function isShotBlock(block: string) {
  return SHOT_TYPE_PATTERN.test(block) || headingMatches(block).length === 1;
}

function parseDelimitedBlocks(content: string): ParsedShotSections | null {
  DELIMITER_PATTERN.lastIndex = 0;
  if (![...content.matchAll(DELIMITER_PATTERN)].length) return null;

  const blocks = content.split(DELIMITER_PATTERN).map((block) => block.trim()).filter(Boolean);
  const firstShotIndex = blocks.findIndex(isShotBlock);
  if (firstShotIndex < 0) return null;
  const shotBlocks = blocks.slice(firstShotIndex);
  if (shotBlocks.length < 2 || !shotBlocks.every(isShotBlock)) return null;

  const sections = shotBlocks.map((body, index) => {
    const headings = headingMatches(body);
    const heading = headings.length === 1 ? headings[0].heading : `Shot ${index + 1}`;
    const contentBody = headings.length === 1
      ? body.slice(headings[0].index + headings[0].source.length).trim()
      : body;
    return { heading, content: contentBody, copyContent: body };
  });
  return { prefix: blocks.slice(0, firstShotIndex).join("\n\n---\n\n"), sections };
}

function parseRepeatedManifests(content: string): ParsedShotSections | null {
  MANIFEST_PATTERN.lastIndex = 0;
  const manifests = [...content.matchAll(MANIFEST_PATTERN)];
  if (manifests.length < 2) return null;

  const sections = manifests.map((manifest, index) => {
    const start = manifest.index ?? 0;
    const end = index + 1 < manifests.length ? manifests[index + 1].index ?? content.length : content.length;
    const body = content.slice(start, end).replace(/\s*---\s*$/, "").trim();
    return { heading: `Shot ${index + 1}`, content: body, copyContent: body };
  });
  return { prefix: content.slice(0, manifests[0].index ?? 0).trim(), sections };
}

export function splitShotSections(content: string): ParsedShotSections | null {
  const normalized = normalizeContent(content);
  return parseExplicitHeadings(normalized)
    ?? parseDelimitedBlocks(normalized)
    ?? parseRepeatedManifests(normalized)
    ?? null;
}
