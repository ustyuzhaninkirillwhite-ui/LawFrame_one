"use client";

import * as React from "react";
import {
  useApprovalRoutes,
  useApprovalTasks,
  useApproveApprovalTask,
  useCreateApprovalRoute,
  useRejectApprovalTask,
} from "@/hooks/use-stage0-data";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function Stage7ApprovalsPanel() {
  const routes = useApprovalRoutes();
  const tasks = useApprovalTasks();
  const createRoute = useCreateApprovalRoute();
  const firstTaskId = tasks.data?.[0]?.id ?? null;
  const approveTask = useApproveApprovalTask(firstTaskId);
  const rejectTask = useRejectApprovalTask(firstTaskId);

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <Badge variant="accent">approval routes</Badge>
          <CardTitle>Manual gates for finalization and delivery</CardTitle>
          <CardDescription>
            External delivery and high-risk finalization stay behind explicit approval tasks.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <Button
            onClick={() => {
              void createRoute.mutateAsync({
                name: "Default finalization route",
                steps: [
                  {
                    stepId: "partner-review",
                    order: 1,
                    approverRole: "owner",
                    title: "Partner review",
                    requiresComment: true,
                    dueInHours: 24,
                  },
                ],
              });
            }}
          >
            Create Approval Route
          </Button>
          <pre className="overflow-auto rounded-[20px] border border-[color:var(--line)] bg-black/20 p-4 text-xs">
            {JSON.stringify(routes.data ?? [], null, 2)}
          </pre>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <Badge variant="muted">approval inbox</Badge>
          <CardTitle>Pending approval tasks</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          {(tasks.data ?? []).map((task) => (
            <div key={task.id} className="rounded-[20px] border border-[color:var(--line)] bg-black/15 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-medium">{task.title}</div>
                  <div className="mt-1 text-xs text-[color:var(--muted)]">
                    {task.status} • due {task.dueAt ?? "n/a"}
                  </div>
                </div>
                {firstTaskId === task.id ? (
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={() => void approveTask.mutateAsync({ comment: "Approved in UI" })}>
                      Approve
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => void rejectTask.mutateAsync({ comment: "Rejected in UI" })}>
                      Reject
                    </Button>
                  </div>
                ) : null}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
