import { useEffect, useState } from "react";
import { GaugeIcon, RefreshCwIcon } from "lucide-react";

import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "../../components/ui/popover";
import { Progress } from "../../components/ui/progress";
import type { PlanUsageSnapshot, ProfilePlanUsage, UsageWindow } from "../../runtime/types";
import { usePlanUsageQuery, useRefreshPlanUsageMutation } from "./plan-usage-queries";
import {
  formatResetClock,
  formatResetCountdown,
  formatSnapshotAge,
  hasBlindProfile,
  type ProfileUsageAssignment,
  profilesForContext,
  profileStateLabel,
  providerLabel,
  usageTone,
  type UsageTone,
} from "./plan-usage-format";

const toneTextClass: Record<UsageTone, string> = {
  normal: "text-muted-foreground",
  warning: "text-amber-600 dark:text-amber-400",
  critical: "text-destructive",
};

const toneBarClass: Record<UsageTone, string> = {
  normal: "[&_[data-slot=progress-indicator]]:bg-primary",
  warning: "[&_[data-slot=progress-indicator]]:bg-amber-500",
  critical: "[&_[data-slot=progress-indicator]]:bg-destructive",
};

export function PlanUsageButton({
  contextName,
  profileAssignments,
}: {
  contextName?: string;
  profileAssignments: readonly ProfileUsageAssignment[];
}) {
  const usageQuery = usePlanUsageQuery();
  const refreshMutation = useRefreshPlanUsageMutation();
  const snapshot = usageQuery.data;
  const contextProfiles = profilesForContext(
    snapshot?.profiles ?? [],
    profileAssignments.map(({ profileId }) => profileId),
  );
  const contextSnapshot = snapshot ? { ...snapshot, profiles: contextProfiles } : undefined;
  const now = useCurrentTime();
  const providerCounts = profileAssignments.reduce(
    (counts, { provider }) => counts.set(provider, (counts.get(provider) ?? 0) + 1),
    new Map<ProfileUsageAssignment["provider"], number>(),
  );
  const summaries = profileAssignments.map((assignment) => {
    const profile = contextProfiles.find(
      (candidate) => candidate.profileId === assignment.profileId,
    );
    const percent = profile
      ? profile.windows.reduce<number | null>(
          (highest, window) =>
            window.usedPercent === null
              ? highest
              : highest === null
                ? window.usedPercent
                : Math.max(highest, window.usedPercent),
          null,
        )
      : null;
    return {
      ...assignment,
      percent,
      tone: percent === null ? "normal" : usageTone(percent),
      label:
        contextName === "All contexts" &&
        providerCounts.get(assignment.provider)! > 1 &&
        (profile?.profileName ?? assignment.profileName)
          ? `${providerLabel(assignment.provider)} (${profile?.profileName ?? assignment.profileName})`
          : providerLabel(assignment.provider),
    };
  });

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-auto min-h-8 shrink-0 gap-2 px-2 text-xs text-muted-foreground hover:bg-secondary hover:text-primary"
          aria-label={
            !contextName
              ? "Plan usage. Choose a Context to see its usage"
              : summaries.length === 0
                ? `Plan usage for ${contextName}. No profiles assigned`
                : `Plan usage for ${contextName}: ${summaries
                    .map(
                      ({ label, percent }) =>
                        `${label} ${percent === null ? "unavailable" : `${Math.round(percent)} percent`}`,
                    )
                    .join(", ")}`
          }
        >
          <GaugeIcon aria-hidden="true" className="size-3.5 shrink-0" />
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
            {summaries.length === 0 ? (
              <span className="text-muted-foreground">—</span>
            ) : (
              summaries.map(({ profileId, label, percent, tone: itemTone }, index) => (
                <span key={profileId} className="inline-flex items-center gap-1.5">
                  {index > 0 ? <span className="text-muted-foreground/60">·</span> : null}
                  <span className="text-muted-foreground">{label}</span>
                  <span className={toneTextClass[itemTone]}>
                    {percent === null ? "—" : `${Math.round(percent)}%`}
                  </span>
                </span>
              ))
            )}
          </span>
          {hasBlindProfile(contextSnapshot) ? (
            <span
              aria-hidden="true"
              className="size-1.5 shrink-0 rounded-full bg-muted-foreground/60"
            />
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 gap-3">
        <PlanUsagePanel
          snapshot={contextSnapshot}
          contextName={contextName}
          now={now}
          error={usageQuery.error}
          isRefreshing={snapshot?.status === "refreshing" || refreshMutation.isPending}
          onRefresh={() => refreshMutation.mutate()}
        />
      </PopoverContent>
    </Popover>
  );
}

function PlanUsagePanel({
  snapshot,
  contextName,
  now,
  error,
  isRefreshing,
  onRefresh,
}: {
  snapshot: PlanUsageSnapshot | undefined;
  contextName?: string;
  now: number;
  error: unknown;
  isRefreshing: boolean;
  onRefresh: () => void;
}) {
  return (
    <>
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-medium">Plan usage{contextName ? ` · ${contextName}` : ""}</span>
        <span className="text-xs text-muted-foreground">
          {isRefreshing
            ? "Reading…"
            : `Read ${formatSnapshotAge(snapshot?.fetchedAt ?? null, now)}`}
        </span>
      </div>

      {error ? <p className="text-xs text-destructive">Plan usage could not be read.</p> : null}

      {!contextName ? (
        <p className="text-xs text-muted-foreground">
          Choose a Context on Work to see its plan limits here.
        </p>
      ) : snapshot && snapshot.profiles.length === 0 && !isRefreshing ? (
        <p className="text-xs text-muted-foreground">
          {contextName === "All contexts"
            ? "No Agent CLI Configuration Profile is assigned to any Context. Add one in Settings to see its plan limits here."
            : "No Agent CLI Configuration Profile is assigned to this Context. Add one in Settings to see its plan limits here."}
        </p>
      ) : null}

      <div className="flex flex-col gap-3">
        {groupByMachine(snapshot?.profiles ?? []).map(([machineName, profiles]) => (
          <div key={machineName} className="flex flex-col gap-2">
            <span className="text-xs font-medium text-muted-foreground">{machineName}</span>
            {profiles.map((profile) => (
              <ProfileRow key={profile.profileId} profile={profile} now={now} />
            ))}
          </div>
        ))}
      </div>

      <div className="flex justify-end">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 gap-1.5 px-2 text-xs"
          disabled={isRefreshing}
          onClick={onRefresh}
        >
          <RefreshCwIcon aria-hidden="true" className="size-3" />
          Refresh
        </Button>
      </div>
    </>
  );
}

function ProfileRow({ profile, now }: { profile: ProfilePlanUsage; now: number }) {
  return (
    <div className="flex flex-col gap-1.5 rounded-md bg-muted/40 p-2">
      <div className="flex items-baseline justify-between gap-2">
        <span className="truncate text-xs">
          {providerLabel(profile.provider)}
          <span className="text-muted-foreground"> · {profile.profileName}</span>
        </span>
        {profile.plan ? (
          <Badge variant="secondary" className="shrink-0 text-[10px] uppercase">
            {profile.plan}
          </Badge>
        ) : null}
      </div>

      {profile.state === "ready" ? (
        profile.windows.map((window) => <WindowBar key={window.id} window={window} now={now} />)
      ) : (
        <p className="text-xs text-muted-foreground">
          {profileStateLabel(profile.state)}
          {profile.detail ? ` — ${profile.detail}` : ""}
        </p>
      )}

      {/* Claude reports numbers a past session cached, so its own age is not
          the age of our read and has to be stated separately. */}
      {profile.state === "ready" && profile.observedAt !== null ? (
        <span className="text-[10px] text-muted-foreground">
          Reported by the CLI {formatSnapshotAge(profile.observedAt, now)}
        </span>
      ) : null}
    </div>
  );
}

function WindowBar({ window, now }: { window: UsageWindow; now: number }) {
  const tone = usageTone(window.usedPercent ?? 0);
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className="truncate text-muted-foreground">{window.label}</span>
        <span className={toneTextClass[tone]}>
          {window.usedPercent === null ? "—" : `${Math.round(window.usedPercent)}%`}
        </span>
      </div>
      {window.usedPercent === null ? null : (
        <Progress value={window.usedPercent} className={toneBarClass[tone]} />
      )}
      {window.resetsAt === null ? null : (
        <span className="text-[10px] text-muted-foreground">
          Resets {formatResetCountdown(window.resetsAt, now)}
          <span className="text-muted-foreground/60">
            {" "}
            · {formatResetClock(window.resetsAt, now)}
          </span>
        </span>
      )}
    </div>
  );
}

function groupByMachine(profiles: ProfilePlanUsage[]) {
  const grouped = new Map<string, ProfilePlanUsage[]>();
  for (const profile of profiles) {
    const existing = grouped.get(profile.machineName);
    if (existing) existing.push(profile);
    else grouped.set(profile.machineName, [profile]);
  }
  return [...grouped];
}

// Countdowns have to keep counting down while the popover stays open.
function useCurrentTime() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);
  return now;
}
