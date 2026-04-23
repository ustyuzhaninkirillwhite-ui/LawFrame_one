import type {
  LegalSearchFilters,
  LegalSearchMode,
  LegalSearchQuery,
  LegalSourceType,
  LegalSourceVisibility,
} from "@lexframe/contracts";
import type { LexframeRequest } from "../../common/types/lexframe-request";
import { Body, Controller, HttpCode, Post, Req, UseGuards } from "@nestjs/common";
import { LexframeRequestContext } from "../../common/decorators/lexframe-request.decorator";
import { RequiredPermissions } from "../../common/decorators/required-permissions.decorator";
import { AppHttpException } from "../../common/errors/app-http.exception";
import { AuthGuard } from "../../common/guards/auth.guard";
import { PermissionGuard } from "../../common/guards/permission.guard";
import { WorkspaceContextGuard } from "../../common/guards/workspace-context.guard";
import { LegalSearchService } from "./legal-search.service";

@Controller()
@UseGuards(AuthGuard, WorkspaceContextGuard, PermissionGuard)
export class LegalSearchController {
  constructor(private readonly legalSearchService: LegalSearchService) {}

  @Post("legal-search/query")
  @HttpCode(200)
  @RequiredPermissions("legal_search.use")
  query(
    @LexframeRequestContext() context: LexframeRequest["lexframe"],
    @Body() body: unknown,
    @Req() request: LexframeRequest,
  ) {
    if (!context?.actor || !context.access) {
    throw new Error("Контекст доступа к рабочему пространству не был привязан.");
    }

    return this.legalSearchService.query(
      context.actor,
      context.access,
      parseLegalSearchQuery(body),
      requestMeta(request),
    );
  }

  @Post("workflow-runtime/legal-search/execute")
  @HttpCode(200)
  @RequiredPermissions("legal_search.use")
  executeForRuntime(
    @LexframeRequestContext() context: LexframeRequest["lexframe"],
    @Body() body: unknown,
    @Req() request: LexframeRequest,
  ) {
    if (!context?.actor || !context.access) {
    throw new Error("Контекст доступа к рабочему пространству не был привязан.");
    }

    return this.legalSearchService.query(
      context.actor,
      context.access,
      parseLegalSearchQuery(body),
      requestMeta(request),
    );
  }
}

function parseLegalSearchQuery(body: unknown): LegalSearchQuery {
  const value = asRecord(body);

  return {
    query: typeof value.query === "string" ? value.query.trim() : "",
    mode: expectMode(value.mode),
    ...(value.filters !== undefined ? { filters: parseFilters(value.filters) } : {}),
    ...(typeof value.limit === "number" ? { limit: value.limit } : {}),
    ...(typeof value.offset === "number" ? { offset: value.offset } : {}),
    ...(Array.isArray(value.selectedSourceIds)
      ? {
          selectedSourceIds: value.selectedSourceIds
            .filter((entry): entry is string => typeof entry === "string")
            .map((entry) => entry.trim())
            .filter((entry) => entry.length > 0),
        }
      : {}),
  };
}

function parseFilters(value: unknown): LegalSearchFilters {
  const record = asRecord(value);

  return {
    ...(Array.isArray(record.sourceType)
      ? {
          sourceType: record.sourceType.filter(isSourceType),
        }
      : {}),
    ...(Array.isArray(record.visibility)
      ? {
          visibility: record.visibility.filter(isVisibility),
        }
      : {}),
    ...(Array.isArray(record.court)
      ? {
          court: record.court
            .filter((entry): entry is string => typeof entry === "string")
            .map((entry) => entry.trim())
            .filter((entry) => entry.length > 0),
        }
      : {}),
    ...(typeof record.dateFrom === "string" && record.dateFrom.trim().length > 0
      ? { dateFrom: record.dateFrom.trim() }
      : {}),
    ...(typeof record.dateTo === "string" && record.dateTo.trim().length > 0
      ? { dateTo: record.dateTo.trim() }
      : {}),
    ...(Array.isArray(record.category)
      ? {
          category: record.category
            .filter((entry): entry is string => typeof entry === "string")
            .map((entry) => entry.trim())
            .filter((entry) => entry.length > 0),
        }
      : {}),
    ...(typeof record.workspaceId === "string" && record.workspaceId.trim().length > 0
      ? { workspaceId: record.workspaceId.trim() }
      : {}),
    ...(typeof record.caseNumber === "string" && record.caseNumber.trim().length > 0
      ? { caseNumber: record.caseNumber.trim() }
      : {}),
  };
}

function expectMode(value: unknown): LegalSearchMode {
  if (value === "keyword" || value === "semantic" || value === "hybrid") {
    return value;
  }

  throw new AppHttpException(
    "VALIDATION_ERROR",
    400,
        "Режим юридического поиска должен быть keyword, semantic или hybrid.",
  );
}

function isSourceType(value: unknown): value is LegalSourceType {
  return (
    value === "court_decision" ||
    value === "statute" ||
    value === "regulation" ||
    value === "contract_template" ||
    value === "user_document" ||
    value === "internal_memo" ||
    value === "analysis_result"
  );
}

function isVisibility(value: unknown): value is LegalSourceVisibility {
  return (
    value === "public" ||
    value === "product_private" ||
    value === "workspace_private" ||
    value === "user_private" ||
    value === "restricted_provider"
  );
}

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new AppHttpException(
      "VALIDATION_ERROR",
      400,
        "Тело запроса должно быть JSON-объектом.",
    );
  }

  return value as Record<string, unknown>;
}

function requestMeta(request: LexframeRequest) {
  return {
    requestId: request.headers["x-request-id"] ?? null,
    traceId: request.headers["x-trace-id"] ?? null,
  };
}
