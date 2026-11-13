import { bearerLearner, signInAgain } from "@/lib/auth/bearer";
import { currentVersions, readRuns, toRunViews } from "@/lib/check-runs/read";

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/**
 * GET /api/check-runs/recent[?check=m1-p1] (T20): the learner's newest recorded runs, for
 * `academy status`. Bearer only (ADR-7); reads as the learner, so RLS shows own rows only.
 * Read-only: nothing here can write.
 */
export async function GET(request: Request) {
  const learner = await bearerLearner(request);
  if (!learner) return signInAgain();
  const checkId = new URL(request.url).searchParams.get("check") ?? undefined;
  const headers = { "Cache-Control": "no-store" };
  if (checkId !== undefined && (!SLUG.test(checkId) || checkId.length > 80)) {
    return Response.json({ error: "bad_request", message: "check is not a check id." }, { status: 400, headers });
  }
  try {
    const rows = await readRuns(learner.supabase, { checkId, limit: 10 });
    const views = toRunViews(rows, await currentVersions(learner.supabase, [...new Set(rows.map((r) => r.check_definitions?.item_slug ?? ""))].filter(Boolean)));
    return Response.json({
      runs: views.map((v) => ({
        run_id: v.id, check_id: v.checkId, version: v.version, current_version: v.currentVersion,
        passed: v.passed, commit_sha: v.commitSha, recorded_at: v.recordedAt,
      })),
    }, { headers });
  } catch (error) {
    console.error("GET /api/check-runs/recent:", error instanceof Error ? error.message : "unknown error");
    return Response.json({ error: "failed", message: "Something went wrong. Try again later." }, { status: 500, headers });
  }
}
