import { expect, test, type APIRequestContext } from "@playwright/test";
import {
  getWorkspaceApiSession,
  type WorkspaceApiSession,
} from "./helpers/api";
import { signInAsDemo } from "./helpers/auth";
import { expectReadinessProfile } from "./helpers/readiness";

test.describe("Stage 5 AI gateway policy smoke", () => {
  test("uses deterministic mock routing and enforces sensitive data gates", async ({
    page,
    request,
  }) => {
    await signInAsDemo(page, {
      email: `stage5-ai-${Date.now()}@lexframe.local`,
      fullName: "Stage5 AI Gateway",
    });

    await expectReadinessProfile(page, request, "local-integrated");
    const session = await getWorkspaceApiSession(page, request);
    const jsonHeaders = {
      ...session.headers,
      "content-type": "application/json",
    };

    const publicDocument = await createCompletedDocument(request, session, {
      title: "Stage 5 public notice",
      classification: "public",
    });
    const confidentialDocument = await createCompletedDocument(
      request,
      session,
      {
        title: "Stage 5 confidential matter",
        classification: "client_material",
      },
    );
    const secretDocument = await createCompletedDocument(request, session, {
      title: "Stage 5 legal secret matter",
      classification: "legal_secret",
    });

    const publicWorkflowResponse = await request.post(
      `${session.apiBaseUrl}/ai/chat/messages`,
      {
        headers: jsonHeaders,
        data: {
          message: "Create a public workflow for reviewing a public notice.",
          mode: "create_workflow",
          selectedDocumentIds: [publicDocument.documentId],
        },
      },
    );
    const publicWorkflowText = await publicWorkflowResponse.text();
    expect(publicWorkflowResponse.ok(), publicWorkflowText).toBeTruthy();
    const publicWorkflow = JSON.parse(publicWorkflowText) as {
      readonly status: string;
      readonly policyReport?: {
        readonly dataClass: string;
        readonly providerRoute: string;
        readonly violations: readonly unknown[];
      };
    };
    expect(publicWorkflow.status).not.toBe("blocked_by_policy");
    expect(publicWorkflow.policyReport?.dataClass).toBe("A_PUBLIC");
    expect(publicWorkflow.policyReport?.providerRoute).toBe("local_mock");
    expect(publicWorkflow.policyReport?.violations).toHaveLength(0);

    const anonymizedPreviewResponse = await request.post(
      `${session.apiBaseUrl}/ai/redaction/preview`,
      {
        headers: jsonHeaders,
        data: {
          text: "Ivan Petrov sent ivan.petrov@example.test about public facts.",
          classification: "B_ANONYMIZED_LEGAL",
          redactionPolicy: "strict",
        },
      },
    );
    const anonymizedPreviewText = await anonymizedPreviewResponse.text();
    expect(anonymizedPreviewResponse.ok(), anonymizedPreviewText).toBeTruthy();
    const anonymizedPreview = JSON.parse(anonymizedPreviewText) as {
      readonly redactedText: string;
      readonly entities: readonly unknown[];
      readonly mappingId: string;
    };
    expect(anonymizedPreview.redactedText).toContain("<EMAIL_1>");
    expect(anonymizedPreview.entities.length).toBeGreaterThan(0);
    expect(anonymizedPreview.mappingId).toBeTruthy();

    const confidentialWorkflowResponse = await request.post(
      `${session.apiBaseUrl}/ai/chat/messages`,
      {
        headers: jsonHeaders,
        data: {
          message: "Create a workflow for a confidential client draft.",
          mode: "create_workflow",
          selectedDocumentIds: [confidentialDocument.documentId],
        },
      },
    );
    const confidentialWorkflowText = await confidentialWorkflowResponse.text();
    expect(
      confidentialWorkflowResponse.ok(),
      confidentialWorkflowText,
    ).toBeTruthy();
    const confidentialWorkflow = JSON.parse(
      confidentialWorkflowText,
    ) as typeof publicWorkflow;
    expect(confidentialWorkflow.status).not.toBe("blocked_by_policy");
    expect(confidentialWorkflow.policyReport?.dataClass).toBe(
      "C_CONFIDENTIAL_CLIENT",
    );
    expect(confidentialWorkflow.policyReport?.providerRoute).toBe("local_mock");
    expect(confidentialWorkflow.policyReport?.providerRoute).not.toBe(
      "cometapi",
    );

    const secretWorkflowResponse = await request.post(
      `${session.apiBaseUrl}/ai/chat/messages`,
      {
        headers: jsonHeaders,
        data: {
          message: "Create a workflow for legal secret materials.",
          mode: "create_workflow",
          selectedDocumentIds: [secretDocument.documentId],
        },
      },
    );
    const secretWorkflowText = await secretWorkflowResponse.text();
    expect(secretWorkflowResponse.ok(), secretWorkflowText).toBeTruthy();
    const secretWorkflow = JSON.parse(secretWorkflowText) as {
      readonly status: string;
      readonly reasonCode?: string;
      readonly policyReport?: {
        readonly providerRoute: string;
      };
    };
    expect(secretWorkflow.status).toBe("blocked_by_policy");
    expect(secretWorkflow.reasonCode).toBe("legal_secret_ai_disabled");
    expect(secretWorkflow.policyReport?.providerRoute).toBe("blocked");

    const malformedDraftResponse = await request.post(
      `${session.apiBaseUrl}/ai/workflow-drafts`,
      {
        headers: jsonHeaders,
        data: {
          title: "Malformed structured output",
          source: "ai_chat",
          workflow: {
            schemaVersion: "lexframe.workflow.v0",
          },
        },
      },
    );
    expect(malformedDraftResponse.status()).toBe(400);
    const malformedDraft = await malformedDraftResponse.json();
    expect(malformedDraft.error?.code).toBe("AI_SCHEMA_VALIDATION_FAILED");

    const deliveryDraftResponse = await request.post(
      `${session.apiBaseUrl}/ai/workflow-drafts`,
      {
        headers: jsonHeaders,
        data: {
          title: "Stage 5 delivery approval workflow",
          source: "ai_chat",
          workflow: buildDeliveryApprovalWorkflow(),
        },
      },
    );
    const deliveryDraftText = await deliveryDraftResponse.text();
    expect(deliveryDraftResponse.ok(), deliveryDraftText).toBeTruthy();
    const deliveryDraft = JSON.parse(deliveryDraftText) as {
      readonly workflow: {
        readonly steps: Array<{
          readonly kind: string;
          readonly requiresApproval: boolean;
        }>;
      };
      readonly policyReport: {
        readonly providerRoute: string;
        readonly externalActionsRequireApproval: boolean;
      };
    };
    expect(deliveryDraft.policyReport.providerRoute).toBe("local_mock");
    expect(deliveryDraft.policyReport.externalActionsRequireApproval).toBe(
      true,
    );
    expect(
      deliveryDraft.workflow.steps
        .filter((step) => step.kind === "deliver")
        .every((step) => step.requiresApproval),
    ).toBe(true);
  });
});

async function createCompletedDocument(
  request: APIRequestContext,
  session: WorkspaceApiSession,
  input: {
    readonly title: string;
    readonly classification: string;
  },
) {
  const jsonHeaders = {
    ...session.headers,
    "content-type": "application/json",
  };
  const uploadIntentResponse = await request.post(
    `${session.apiBaseUrl}/documents/upload-intents`,
    {
      headers: jsonHeaders,
      data: {
        title: input.title,
        description: "Stage 5 AI policy smoke fixture",
        kind: "case_material",
        classification: input.classification,
        mimeType: "application/pdf",
        originalFilename: `${input.title.toLowerCase().replace(/\s+/g, "-")}.pdf`,
        sizeBytes: 65536,
        tags: ["stage5", "ai-policy"],
      },
    },
  );
  expect(uploadIntentResponse.ok()).toBeTruthy();
  const uploadIntent = (await uploadIntentResponse.json()) as {
    readonly documentId: string;
    readonly versionId: string;
  };

  const completeResponse = await request.post(
    `${session.apiBaseUrl}/documents/${uploadIntent.documentId}/versions/${uploadIntent.versionId}/complete`,
    {
      headers: jsonHeaders,
      data: {
        clientReportedSize: 65536,
        clientReportedMimeType: "application/pdf",
      },
    },
  );
  expect(completeResponse.ok()).toBeTruthy();

  return uploadIntent;
}

function buildDeliveryApprovalWorkflow() {
  return {
    schemaVersion: "lexframe.workflow.v1",
    id: "stage5-delivery-approval",
    title: "Stage 5 delivery approval workflow",
    description: "Prepare a public delivery draft with manual approval.",
    intent: "Verify AI-generated delivery cannot bypass approval.",
    jurisdiction: "ru",
    practiceArea: "stage14_smoke",
    inputs: [
      {
        inputId: "public_document",
        label: "Public document",
        type: "document",
        required: true,
        source: "user_selection",
        dataClass: "public",
      },
    ],
    outputs: [
      {
        outputId: "client_email",
        label: "Client email draft",
        type: "message",
        format: "email",
      },
    ],
    steps: [
      {
        stepId: "draft-delivery",
        moduleCode: "delivery.email-draft",
        moduleVersion: "v1",
        title: "Draft delivery message",
        description: "Prepare an email draft without automatic sending.",
        kind: "deliver",
        inputBindings: {
          document: "$inputs.public_document",
        },
        outputBindings: {
          emailDraft: "$outputs.client_email",
        },
        requiresApproval: true,
        dataPolicy: {
          maxClass: "public",
          allowedAiRoutes: ["local_mock"],
        },
        runtime: {
          requiredPiece: "@lexframe/email-delivery",
          requiredConnection: "gmail",
        },
      },
    ],
    transitions: [],
    approvalPolicy: {
      externalActionsRequireApproval: true,
      documentGenerationRequiresReview: true,
    },
    securityLabels: [],
    createdBy: "ai_planner",
    confidence: 0.9,
  };
}
