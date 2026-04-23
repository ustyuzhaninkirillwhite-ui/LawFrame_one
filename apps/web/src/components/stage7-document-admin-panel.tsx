"use client";

import * as React from "react";
import {
  useClauses,
  useCreateClause,
  useCreateDocumentTemplate,
  useCreateDocumentType,
  useCreatePhraseRule,
  useDocumentStructures,
  useDocumentTemplates,
  useDocumentTypes,
  useParseDocumentTemplatePlaceholders,
  usePhraseRules,
  usePublishDocumentTemplateDraft,
} from "@/hooks/use-stage0-data";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Stage7RichTextEditor } from "./stage7-rich-text-editor";

type Mode = "structures" | "clauses" | "templates";

export function Stage7DocumentAdminPanel({ mode }: { readonly mode: Mode }) {
  const documentTypes = useDocumentTypes();
  const documentStructures = useDocumentStructures();
  const clauses = useClauses();
  const phraseRules = usePhraseRules();
  const templates = useDocumentTemplates();
  const createDocumentType = useCreateDocumentType();
  const createClause = useCreateClause();
  const createPhraseRule = useCreatePhraseRule();
  const createTemplate = useCreateDocumentTemplate();
  const firstTemplateId = templates.data?.[0]?.id ?? null;
  const parseTemplate = useParseDocumentTemplatePlaceholders(firstTemplateId);
  const firstTemplateVersionId = templates.data?.[0]?.activeVersionId ?? null;
  const publishTemplate = usePublishDocumentTemplateDraft(firstTemplateVersionId);

  const [clauseTitle, setClauseTitle] = React.useState("Фирменная оговорка");
  const [clauseContent, setClauseContent] = React.useState<Record<string, unknown>>({
    type: "doc",
    content: [{ type: "paragraph", content: [{ type: "text", text: "Введите текст оговорки." }] }],
  });
  const [sourceDocumentId, setSourceDocumentId] = React.useState("");
  const [sourceDocumentVersionId, setSourceDocumentVersionId] = React.useState("");

  if (mode === "structures") {
    return (
      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <Badge variant="accent">document types</Badge>
            <CardTitle>Document structures and required sections</CardTitle>
            <CardDescription>
              Structure records define required blocks, locked sections and placeholder-ready slots.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <Button
              onClick={() => {
                void createDocumentType.mutateAsync({
                  code: `claim-${Date.now()}`,
                  name: "Statement of claim",
                  structure: [
                    {
                      sectionId: "facts",
                      title: "Facts",
                      kind: "facts",
                      required: true,
                      order: 1,
                      locked: false,
                      clauseIds: [],
                      placeholderCodes: ["facts.summary"],
                    },
                  ],
                });
              }}
            >
              Create Draft Document Type
            </Button>
            <div className="grid gap-3 md:grid-cols-2">
              {(documentTypes.data ?? []).map((item) => (
                <div key={item.id} className="rounded-[20px] border border-[color:var(--line)] bg-black/15 p-4">
                  <div className="text-sm font-medium">{item.name}</div>
                  <div className="mt-1 text-xs text-[color:var(--muted)]">
                    {item.code} • {item.status}
                  </div>
                </div>
              ))}
            </div>
            <pre className="overflow-auto rounded-[20px] border border-[color:var(--line)] bg-black/20 p-4 text-xs">
              {JSON.stringify(documentStructures.data ?? [], null, 2)}
            </pre>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (mode === "clauses") {
    return (
      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <Badge variant="accent">clause library</Badge>
            <CardTitle>Reusable clause library and phrase rules</CardTitle>
            <CardDescription>
              Rich-text payload stays schema-driven JSON; forbidden and preferred phrases stay separate from clause content.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <input
              className="h-11 rounded-full border border-[color:var(--line)] bg-transparent px-4 text-sm"
              value={clauseTitle}
              onChange={(event) => setClauseTitle(event.target.value)}
            />
            <Stage7RichTextEditor value={clauseContent} onChange={setClauseContent} />
            <div className="flex flex-wrap gap-3">
              <Button
                onClick={() => {
                  void createClause.mutateAsync({
                    scope: "workspace",
                    title: clauseTitle,
                    tags: ["stage7"],
                    richText: clauseContent,
                  });
                }}
              >
                Save Clause
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  void createPhraseRule.mutateAsync({
                    ruleType: "forbidden",
                    phrase: "безусловно",
                    rationale: "Предпочитать более точную юридическую формулировку.",
                  });
                }}
              >
                Add Forbidden Phrase
              </Button>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {(clauses.data ?? []).map((item) => (
                <div key={item.id} className="rounded-[20px] border border-[color:var(--line)] bg-black/15 p-4">
                  <div className="text-sm font-medium">{item.title}</div>
                  <div className="mt-1 text-xs text-[color:var(--muted)]">
                    {item.scope} • {item.status}
                  </div>
                </div>
              ))}
            </div>
            <pre className="overflow-auto rounded-[20px] border border-[color:var(--line)] bg-black/20 p-4 text-xs">
              {JSON.stringify(phraseRules.data ?? [], null, 2)}
            </pre>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <Badge variant="accent">templates</Badge>
          <CardTitle>Canonical template library</CardTitle>
          <CardDescription>
            Template metadata, placeholders and mappings live above the existing document domain rather than beside it.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <input
            className="h-11 rounded-full border border-[color:var(--line)] bg-transparent px-4 text-sm"
            placeholder="Source document id"
            value={sourceDocumentId}
            onChange={(event) => setSourceDocumentId(event.target.value)}
          />
          <input
            className="h-11 rounded-full border border-[color:var(--line)] bg-transparent px-4 text-sm"
            placeholder="Source document version id"
            value={sourceDocumentVersionId}
            onChange={(event) => setSourceDocumentVersionId(event.target.value)}
          />
          <div className="flex flex-wrap gap-3">
            <Button
              onClick={() => {
                void createTemplate.mutateAsync({
                  sourceDocumentId,
                  sourceDocumentVersionId,
                  title: "Stage 7 template",
                  visibility: "workspace",
                  placeholders: [
                    {
                      code: "profile.client.name",
                      label: "Client name",
                      required: true,
                      sourceType: "profile",
                    },
                  ],
                  mappings: [
                    {
                      placeholderCode: "profile.client.name",
                      sourcePath: "profile.client.name",
                      required: true,
                    },
                  ],
                });
              }}
            >
              Register Template
            </Button>
            <Button variant="ghost" disabled={!firstTemplateId} onClick={() => void parseTemplate.mutateAsync()}>
              Parse Placeholders
            </Button>
            <Button variant="ghost" disabled={!firstTemplateVersionId} onClick={() => void publishTemplate.mutateAsync({})}>
              Publish Active Draft
            </Button>
          </div>
          <pre className="overflow-auto rounded-[20px] border border-[color:var(--line)] bg-black/20 p-4 text-xs">
            {JSON.stringify(templates.data ?? [], null, 2)}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}
