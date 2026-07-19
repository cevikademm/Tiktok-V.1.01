"use client";

import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import type { ImportCounts, ImportIssue } from "@/lib/tfc/types";

/**
 * İçe aktarma önizleme raporu — ADR-0007.
 *
 * Kullanıcı ONAYLAMADAN ÖNCE ne geleceğini ve neyin atlandığını görür.
 * "Atlandı" listesi gerekçesiyle birlikte açılır; sessiz veri kaybı olmaz.
 */

const COUNT_ROWS = [
  "actions",
  "events",
  "timers",
  "screens",
  "widgets",
] as const satisfies readonly (keyof ImportCounts)[];

export function ImportReport({
  counts,
  warnings,
  skipped,
  sourceVersion,
  container,
}: {
  counts: ImportCounts;
  warnings: ImportIssue[];
  skipped: ImportIssue[];
  sourceVersion: string;
  container: string;
}) {
  const t = useTranslations();
  const [openList, setOpenList] = useState<"warnings" | "skipped" | null>(null);

  return (
    <div className="flex flex-col gap-4">
      <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-3">
        {COUNT_ROWS.map((key) => (
          <div key={key} className="flex items-baseline justify-between gap-2">
            <dt className="text-muted">{t(`setup.importExport.counts.${key}`)}</dt>
            <dd className="font-semibold text-white tabular-nums">{counts[key]}</dd>
          </div>
        ))}
      </dl>

      <p className="text-xs text-muted">
        {t("setup.importExport.sourceInfo", { version: sourceVersion, container })}
      </p>

      <IssueList
        kind="warnings"
        issues={warnings}
        open={openList === "warnings"}
        onToggle={() => setOpenList(openList === "warnings" ? null : "warnings")}
      />
      <IssueList
        kind="skipped"
        issues={skipped}
        open={openList === "skipped"}
        onToggle={() => setOpenList(openList === "skipped" ? null : "skipped")}
      />
    </div>
  );
}

/**
 * Sorun listesi. Aynı (kod, kapsam) çiftinden onlarca satır olabilir
 * (ör. 40 eylemde aynı bilinmeyen tip) — bu yüzden gruplanıp sayı gösterilir.
 */
function IssueList({
  kind,
  issues,
  open,
  onToggle,
}: {
  kind: "warnings" | "skipped";
  issues: ImportIssue[];
  open: boolean;
  onToggle: () => void;
}) {
  const t = useTranslations();

  const groups = useMemo(() => {
    const map = new Map<string, { issue: ImportIssue; refs: string[] }>();
    for (const issue of issues) {
      const key = `${issue.scope}:${issue.code}:${issue.detail ?? ""}`;
      const existing = map.get(key);
      if (existing) {
        if (issue.ref) existing.refs.push(issue.ref);
      } else {
        map.set(key, { issue, refs: issue.ref ? [issue.ref] : [] });
      }
    }
    return [...map.values()];
  }, [issues]);

  if (issues.length === 0) return null;

  return (
    <div className="rounded-lg border border-surface-4 bg-surface-2">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm"
      >
        <span className={kind === "skipped" ? "text-danger" : "text-warning"}>
          {t(`setup.importExport.${kind}Title`, { count: issues.length })}
        </span>
        <span aria-hidden className="text-muted">
          {open ? "−" : "+"}
        </span>
      </button>

      {open && (
        <ul className="flex flex-col gap-1 border-t border-surface-4 px-3 py-2 text-xs">
          {groups.map(({ issue, refs }) => (
            <li key={`${issue.scope}-${issue.code}-${issue.detail}`} className="text-muted">
              <span className="text-white">
                {t(`setup.importExport.scope.${issue.scope}`)}
              </span>
              {" — "}
              {t(`setup.importExport.issue.${issue.code}`, {
                detail: issue.detail ?? "",
              })}
              {refs.length > 0 && (
                <span className="ml-1 opacity-70">
                  ({refs.slice(0, 3).join(", ")}
                  {refs.length > 3
                    ? t("setup.importExport.andMore", { count: refs.length - 3 })
                    : ""}
                  )
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
