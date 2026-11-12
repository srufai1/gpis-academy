/**
 * Builds the content index and the check manifest from content/ (T05).
 * Used by scripts/build-content.mjs and by the tests.
 */
import { loadCourse, ContentError, sha256 } from "../../packages/shared/src/content-load.ts";

/** content_items rows, parents before children, in course order. */
export function contentItems(course) {
  const items = [];
  for (const m of course.modules) {
    items.push({ slug: m.slug, kind: "module", parent_slug: null, position: m.number, title: m.title, guidance: m.guidance, content_hash: sha256(JSON.stringify(m)) });
  }
  for (const u of course.units) {
    const moduleSlug = course.modules.find((m) => m.number === u.meta.module).slug;
    items.push({ slug: u.meta.id, kind: "unit", parent_slug: moduleSlug, position: u.meta.position, title: u.meta.title, guidance: u.meta.guidance, content_hash: u.hashes.unit });
    items.push({ slug: u.quiz.id, kind: "quiz", parent_slug: u.meta.id, position: 1, title: u.quiz.title, guidance: u.meta.guidance, content_hash: u.hashes.quiz });
    items.push({ slug: u.check.id, kind: "project", parent_slug: u.meta.id, position: 2, title: u.check.title, guidance: u.meta.guidance, content_hash: u.hashes.project });
  }
  return items;
}

/**
 * index.json: the course structure, with no quiz answers or reasons in it.
 * manifest.json: every check's id, version and folder hash.
 */
export function buildContent(contentRoot, previousManifest = null) {
  const course = loadCourse(contentRoot);
  const checks = course.units.map((u) => ({ id: u.check.id, version: u.check.version, sha256: u.hashes.check, unit: u.meta.id }));

  // A check/ change must come with a new version (docs/checker.md).
  const problems = [];
  for (const check of checks) {
    const before = previousManifest?.checks?.find((c) => c.id === check.id && c.version === check.version);
    if (before && before.sha256 !== check.sha256) {
      const unit = course.units.find((u) => u.check.id === check.id);
      const where = unit.dir.slice(unit.dir.lastIndexOf("module-")).split("\\").join("/");
      problems.push(`${where}/check/check.yaml: the check/ folder changed but version ${check.version} did not; give it a new version`);
    }
  }
  if (problems.length) throw new ContentError(problems);

  const index = { modules: course.modules, items: contentItems(course) };
  const manifest = { checks };
  return { course, index, manifest };
}
