/**
 * Splits a lab's Markdown into its "## " sections and decides what each guidance
 * level shows (T10). Pure. "## " lines inside code fences are not headings.
 * Rules: "Steps" shows only in guided projects; "Hints" in guided and half-guided ones.
 */
export type Guidance = "guided" | "half" | "independent";
export type Section = { heading: string; body: string };

export function splitSections(markdown: string): { intro: string; sections: Section[] } {
  const lines = markdown.split(/\r?\n/);
  const intro: string[] = [];
  const sections: { heading: string; lines: string[] }[] = [];
  let fence: string | null = null;
  for (const line of lines) {
    const marker = /^(```|~~~)/.exec(line.trim());
    if (marker) fence = fence === null ? marker[1]! : fence === marker[1] ? null : fence;
    const heading = fence === null && !marker ? /^## (.+)$/.exec(line) : null;
    if (heading) sections.push({ heading: heading[1]!.trim(), lines: [] });
    else (sections.at(-1)?.lines ?? intro).push(line);
  }
  return { intro: intro.join("\n").trim(), sections: sections.map((s) => ({ heading: s.heading, body: s.lines.join("\n").trim() })) };
}

const isSteps = (s: Section) => /^steps\b/i.test(s.heading);
const isHints = (s: Section) => /^hints?\b/i.test(s.heading);

/** Number of top-level list items ("1." or "-") in a section: the count shown on its fold. */
export function countItems(body: string): number {
  return body.split(/\r?\n/).filter((l) => /^(\d+\.|[-*]) /.test(l)).length;
}

export function projectParts(lab: string, guidance: Guidance) {
  const { intro, sections } = splitSections(stripTitle(lab));
  const steps = sections.find(isSteps) ?? null;
  const hints = sections.find(isHints) ?? null;
  const task = sections.filter((s) => !isSteps(s) && !isHints(s));
  return {
    intro,
    task,
    steps: guidance === "guided" ? steps : null,
    hints: guidance === "guided" || guidance === "half" ? hints : null,
  };
}

/** Drops a leading "# Title" line: the page already shows the title as its heading. */
export function stripTitle(markdown: string): string {
  return markdown.replace(/^\s*# [^\n]*\n?/, "");
}
