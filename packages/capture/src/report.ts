import { readFile } from 'node:fs/promises';
import path from 'node:path';

import type { SnapshotResult, SnapshotRunResult } from './snapshot.ts';

/**
 * A single self-contained `report.html`: baseline / current / diff triplets
 * for changed stories plus a summary header.
 *
 * Deliberately basic. It is throwaway and gets replaced by the review server
 * at M1, so this is not the place to build a review UI.
 *
 * Images are embedded as data URIs to keep the file self-contained, which
 * means a run with many large changes produces a large HTML file.
 */

const REPORTED = new Set<SnapshotResult['status']>(['changed', 'quarantined', 'failed']);

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

async function dataUri(runDir: string, file: string | undefined): Promise<string | null> {
  if (!file) return null;
  try {
    const bytes = await readFile(path.join(runDir, file));
    return `data:image/png;base64,${bytes.toString('base64')}`;
  } catch {
    return null;
  }
}

function percent(fraction: number): string {
  return fraction === 0 ? '0%' : `${(fraction * 100).toFixed(3)}%`;
}

async function renderResult(run: SnapshotRunResult, result: SnapshotResult): Promise<string> {
  const panels = await Promise.all(
    (['baseline', 'current', 'diff'] as const).map(async (kind) => {
      const uri = await dataUri(run.runDir, result.files[kind]);
      return `<figure><figcaption>${kind}</figcaption>${
        uri ? `<img alt="${escapeHtml(`${result.key} ${kind}`)}" src="${uri}">` : '<p>none</p>'
      }</figure>`;
    }),
  );

  return `<section class="result ${result.status}">
  <h3>${escapeHtml(result.key)}</h3>
  <p class="meta">${result.status} · ${percent(result.changedFraction)} changed
    (${result.changedPixels} px) · ${Math.round(result.durationMs)} ms${
      result.error ? ` · <span class="error">${escapeHtml(result.error)}</span>` : ''
    }</p>
  <div class="triplet">${panels.join('')}</div>
</section>`;
}

export async function renderReport(run: SnapshotRunResult): Promise<string> {
  const reported = run.results.filter((result) => REPORTED.has(result.status));
  const sections = await Promise.all(reported.map((result) => renderResult(run, result)));
  const fingerprint = run.fingerprint;

  const warning =
    run.fingerprintMismatch.length > 0
      ? `<div class="warn"><strong>Baselines were captured in a different environment.</strong>
        Differences below may not be visual changes.
        <ul>${run.fingerprintMismatch.map((line) => `<li>${escapeHtml(line)}</li>`).join('')}</ul></div>`
      : '';

  const newBaselines = run.wroteNewBaselines
    ? '<div class="warn">New baselines were written for stories that had none. Nothing was compared for those.</div>'
    : '';

  return `<!doctype html>
<meta charset="utf-8">
<title>snapcheck run</title>
<style>
  body { font: 14px/1.5 system-ui, sans-serif; margin: 0; padding: 24px; background: #f6f6f4; color: #1a1a1a; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  .counts { display: flex; flex-wrap: wrap; gap: 16px; margin: 16px 0; padding: 0; list-style: none; }
  .counts li { background: #fff; border: 1px solid #ddd; padding: 8px 12px; }
  .counts strong { display: block; font-size: 20px; }
  .env { font-family: ui-monospace, monospace; font-size: 12px; color: #555; white-space: pre-wrap; }
  .warn { background: #fff4e5; border: 1px solid #e0b070; padding: 12px; margin: 16px 0; }
  .result { background: #fff; border: 1px solid #ddd; padding: 16px; margin: 16px 0; }
  .result h3 { font-family: ui-monospace, monospace; font-size: 14px; margin: 0 0 4px; }
  .meta { color: #555; margin: 0 0 12px; }
  .error { color: #a3231a; }
  .triplet { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 12px; }
  figure { margin: 0; }
  figcaption { font-size: 12px; color: #555; margin-bottom: 4px; }
  img { max-width: 100%; border: 1px solid #eee; background: #fff; }
</style>
<h1>snapcheck run</h1>
<p class="env">${escapeHtml(run.runDir)}</p>
<ul class="counts">
  <li><strong>${run.counts.changed}</strong> changed</li>
  <li><strong>${run.counts.new}</strong> new</li>
  <li><strong>${run.counts.unchanged}</strong> unchanged</li>
  <li><strong>${run.counts.failed}</strong> failed</li>
  <li><strong>${run.counts.quarantined}</strong> quarantined</li>
</ul>
${warning}
${newBaselines}
<p class="env">${escapeHtml(
    [
      `${fingerprint.os} ${fingerprint.arch}`,
      `Chromium ${fingerprint.chromiumVersion}, Playwright ${fingerprint.playwrightVersion}`,
      `headless=${fingerprint.headlessMode} dsf=${fingerprint.deviceScaleFactor} gpu=${fingerprint.gpu.active}`,
      `threshold=${run.threshold} pixelThreshold=${run.pixelThreshold}`,
    ].join('\n'),
  )}</p>
${sections.join('\n') || '<p>No changed, quarantined or failed stories.</p>'}
`;
}
