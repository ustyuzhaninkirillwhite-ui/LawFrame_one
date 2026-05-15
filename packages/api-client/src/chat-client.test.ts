import { createChatClient } from "./chat-client";

test("chat API client keeps project/global chat and attachment flows on LexFrame backend paths", async () => {
  const calls: Array<{ readonly url: string; readonly init: RequestInit }> = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    return jsonResponse({});
  }) as typeof fetch;

  try {
    const client = createChatClient({
      baseUrl: "https://lexframe.example/api",
      getAccessToken: () => "session-token",
      getWorkspaceId: () => "workspace_001",
    });

    await client.createChatThread({ title: "Global", kind: "general" });
    await client.listChatThreads({
      scope: "project",
      projectId: "project_claim_001",
    });
    await client.createChatAttachmentUploadIntents({
      threadId: "thread_001",
      files: [
        {
          clientAttachmentId: "client_1",
          filename: "evidence.pdf",
          mimeType: "application/pdf",
          sizeBytes: 12,
        },
      ],
    });
    await client.completeChatAttachmentUpload("attachment_001", {
      threadId: "thread_001",
      sha256: "sha256:file",
    });
    await client.searchProjectWeb("project_claim_001", {
      query: "поставка",
      saveResults: true,
    });

    assertDeepEqual(
      calls.map((call) => call.url),
      [
        "https://lexframe.example/api/chat/threads",
        "https://lexframe.example/api/chat/threads?scope=project&projectId=project_claim_001",
        "https://lexframe.example/api/chat/attachments/upload-intents",
        "https://lexframe.example/api/chat/attachments/attachment_001/complete",
        "https://lexframe.example/api/projects/project_claim_001/web-search",
      ],
    );
    assertEqual(
      calls.some((call) => /api\.openai\.com|api\.tavily\.com|cometapi/i.test(call.url)),
      false,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("chat API client parses SSE stream events and returns final snapshot", async () => {
  const seenEvents: string[] = [];
  const calls: Array<{ readonly url: string; readonly init: RequestInit }> = [];
  const originalFetch = globalThis.fetch;
  const snapshot = {
    streamId: "stream_001",
    workspaceId: "workspace_001",
    threadId: "thread_001",
    messageId: "message_assistant",
    status: "completed",
    events: [],
  };
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    return new Response(
      new ReadableStream({
        start(controller) {
          const encoder = new TextEncoder();
          controller.enqueue(
            encoder.encode(
              [
                'data: {"type":"run_status","payload":{"streamId":"stream_001","status":"streaming"}}',
                "",
                'data: {"type":"text_delta","payload":{"messageId":"message_assistant","delta":"visible"}}',
                "",
                "data: not-json",
                "",
                `data: ${JSON.stringify({ type: "done", payload: { snapshot } })}`,
                "",
                "",
              ].join("\n"),
            ),
          );
          controller.close();
        },
      }),
      { status: 200, headers: { "content-type": "text/event-stream" } },
    );
  }) as typeof fetch;

  try {
    const client = createChatClient({
      baseUrl: "https://lexframe.example/api",
    });

    const result = await client.streamChatMessageEvents(
      "thread_001",
      { text: "Проверь позицию", clientMessageId: "client_1" },
      {
        onEvent: (event) => {
          seenEvents.push(event.type);
        },
      },
    );

    assertEqual(
      calls[0]?.url,
      "https://lexframe.example/api/chat/threads/thread_001/messages:stream",
    );
    assertEqual(calls[0]?.init.method, "POST");
    assertEqual(seenEvents.includes("run_status"), true);
    assertEqual(seenEvents.includes("text_delta"), true);
    assertEqual(seenEvents.includes("done"), true);
    assertEqual(result.streamId, "stream_001");
    assertEqual(result.status, "completed");
    assertEqual(JSON.stringify(calls).includes("Authorization"), false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

async function test(
  name: string,
  fn: () => Promise<void> | void,
): Promise<void> {
  try {
    await fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

function jsonResponse(value: unknown) {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

function assertEqual(actual: unknown, expected: unknown): void {
  if (actual !== expected) {
    throw new Error(`Expected ${String(expected)}, received ${String(actual)}`);
  }
}

function assertDeepEqual(actual: unknown, expected: unknown): void {
  const actualJson = JSON.stringify(actual);
  const expectedJson = JSON.stringify(expected);
  if (actualJson !== expectedJson) {
    throw new Error(`Expected ${expectedJson}, received ${actualJson}`);
  }
}
