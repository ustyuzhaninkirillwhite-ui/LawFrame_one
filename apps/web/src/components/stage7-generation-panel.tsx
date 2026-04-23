"use client";

import { useDocumentGenerationJob, useDocumentValidationReport, useFinalizeDocumentGeneration } from "@/hooks/use-stage0-data";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function Stage7GenerationPanel({ jobId }: { readonly jobId: string }) {
  const job = useDocumentGenerationJob(jobId);
  const finalize = useFinalizeDocumentGeneration(jobId);
  const validation = useDocumentValidationReport(job.data?.validationReportId ?? null);

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <Badge variant="accent">generation</Badge>
          <CardTitle>Preview, validation and approval gate</CardTitle>
          <CardDescription>
            Finalize stays blocked until approval route is satisfied; readiness state comes from backend.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="flex flex-wrap gap-3">
            <Badge variant="muted">{job.data?.status ?? "loading"}</Badge>
            <Badge variant="muted">
              validation: {validation.data?.status ?? job.data?.validationReportId ?? "none"}
            </Badge>
          </div>
          <Button onClick={() => void finalize.mutateAsync({})}>Finalize</Button>
          <pre className="overflow-auto rounded-[20px] border border-[color:var(--line)] bg-black/20 p-4 text-xs">
            {JSON.stringify(job.data ?? null, null, 2)}
          </pre>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <Badge variant="muted">validation report</Badge>
          <CardTitle>Blocking issues</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="overflow-auto rounded-[20px] border border-[color:var(--line)] bg-black/20 p-4 text-xs">
            {JSON.stringify(validation.data ?? null, null, 2)}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}
