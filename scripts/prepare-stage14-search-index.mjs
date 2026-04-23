const opensearchUrl = (process.env.OPENSEARCH_URL ?? "http://127.0.0.1:9200").replace(
  /\/$/,
  "",
);
const indexAlias = process.env.OPENSEARCH_INDEX_ALIAS ?? "legal_chunks_current";

async function main() {
  await waitForOpenSearch();

  const exists = await fetch(`${opensearchUrl}/${encodeURIComponent(indexAlias)}`, {
    method: "HEAD",
  });

  if (exists.ok) {
    console.log(`OpenSearch index ${indexAlias} already exists.`);
    return;
  }

  const create = await fetch(`${opensearchUrl}/${encodeURIComponent(indexAlias)}`, {
    method: "PUT",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      settings: {
        index: {
          number_of_shards: 1,
          number_of_replicas: 0,
        },
      },
      mappings: {
        properties: {
          sourceId: { type: "keyword" },
          chunkId: { type: "keyword" },
          workspaceId: { type: "keyword" },
          visibility: { type: "keyword" },
          title: { type: "text" },
          text: { type: "text" },
          indexedAt: { type: "date" },
        },
      },
    }),
  });

  if (!create.ok) {
    throw new Error(
      `Failed to create OpenSearch index ${indexAlias}: ${create.status} ${await create.text()}`,
    );
  }

  console.log(`OpenSearch index ${indexAlias} created.`);
}

async function waitForOpenSearch() {
  const deadline = Date.now() + 60_000;
  let lastError = "not attempted";

  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${opensearchUrl}/_cluster/health`);
      if (response.ok) {
        return;
      }
      lastError = `${response.status} ${await response.text()}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : "unknown error";
    }

    await new Promise((resolve) => setTimeout(resolve, 2_000));
  }

  throw new Error(`OpenSearch did not become ready: ${lastError}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
