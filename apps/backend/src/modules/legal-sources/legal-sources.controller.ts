import type {
  CreateLegalImportJobRequest,
  DataClassification,
  LegalSourceType,
} from "@lexframe/contracts";
import type { LexframeRequest } from "../../common/types/lexframe-request";
import { dataClassification } from "@lexframe/contracts";
import { Body, Controller, Get, HttpCode, Param, Post, Req, UseGuards } from "@nestjs/common";
import { LexframeRequestContext } from "../../common/decorators/lexframe-request.decorator";
import { RequiredPermissions } from "../../common/decorators/required-permissions.decorator";
import { AppHttpException } from "../../common/errors/app-http.exception";
import { AuthGuard } from "../../common/guards/auth.guard";
import { PermissionGuard } from "../../common/guards/permission.guard";
import { WorkspaceContextGuard } from "../../common/guards/workspace-context.guard";
import { LegalSourcesService } from "./legal-sources.service";

@Controller()
@UseGuards(AuthGuard, WorkspaceContextGuard, PermissionGuard)
export class LegalSourcesController {
  constructor(private readonly legalSourcesService: LegalSourcesService) {}

  @Post("legal-sources/import-jobs")
  @HttpCode(200)
  @RequiredPermissions("legal_sources.manage")
  createImportJob(
    @LexframeRequestContext() context: LexframeRequest["lexframe"],
    @Body() body: unknown,
    @Req() request: LexframeRequest,
  ) {
    if (!context?.actor || !context.access) {
      throw new Error("Workspace access context was not attached.");
    }

    return this.legalSourcesService.createImportJob(
      context.actor,
      context.access,
      parseCreateLegalImportJobRequest(body),
      requestMeta(request),
    );
  }

  @Get("legal-sources")
  @RequiredPermissions("legal_search.use")
  listSources(@LexframeRequestContext() context: LexframeRequest["lexframe"]) {
    if (!context?.actor || !context.access) {
      throw new Error("Workspace access context was not attached.");
    }

    return this.legalSourcesService.listSources(context.actor, context.access);
  }

  @Get("legal-sources/:sourceId")
  @RequiredPermissions("legal_search.use")
  getSource(
    @LexframeRequestContext() context: LexframeRequest["lexframe"],
    @Param("sourceId") sourceId: string,
  ) {
    if (!context?.actor || !context.access) {
      throw new Error("Workspace access context was not attached.");
    }

    return this.legalSourcesService.getSourceDetail(
      context.actor,
      context.access,
      sourceId,
    );
  }

  @Get("legal-import-jobs/:jobId")
  @RequiredPermissions("legal_sources.manage")
  getImportJob(
    @LexframeRequestContext() context: LexframeRequest["lexframe"],
    @Param("jobId") jobId: string,
  ) {
    if (!context?.access?.activeWorkspace?.id) {
      throw new Error("Workspace access context was not attached.");
    }

    return this.legalSourcesService.getImportJob(
      context.access.activeWorkspace.id,
      jobId,
    );
  }
}

function parseCreateLegalImportJobRequest(body: unknown): CreateLegalImportJobRequest {
  const value = asRecord(body);

  return {
    providerCode: expectString(value.providerCode, "Provider code is required."),
    inputType: expectInputType(value.inputType),
    documentType: expectLegalSourceType(value.documentType),
    classification: expectClassification(value.classification),
    ...(typeof value.workspaceId === "string" && value.workspaceId.trim().length > 0
      ? { workspaceId: value.workspaceId.trim() }
      : {}),
    ...(typeof value.documentId === "string" && value.documentId.trim().length > 0
      ? { documentId: value.documentId.trim() }
      : {}),
    ...(Array.isArray(value.files)
      ? {
          files: value.files.map((entry) => {
            const file = asRecord(entry);
            return {
              uploadId: expectString(file.uploadId, "File uploadId is required."),
              title: expectString(file.title, "File title is required."),
              mimeType: expectString(file.mimeType, "File mimeType is required."),
            };
          }),
        }
      : {}),
    ...(value.metadata !== undefined
      ? {
          metadata: asLooseRecord(value.metadata, "Metadata must be an object."),
        }
      : {}),
  };
}

function expectInputType(value: unknown): CreateLegalImportJobRequest["inputType"] {
  if (
    value === "files" ||
    value === "document" ||
    value === "seed" ||
    value === "external_payload"
  ) {
    return value;
  }

  throw new AppHttpException(
    "VALIDATION_ERROR",
    400,
    "Import inputType is invalid.",
  );
}

function expectLegalSourceType(value: unknown): LegalSourceType {
  if (
    value === "court_decision" ||
    value === "statute" ||
    value === "regulation" ||
    value === "contract_template" ||
    value === "user_document" ||
    value === "internal_memo" ||
    value === "analysis_result"
  ) {
    return value;
  }

  throw new AppHttpException(
    "VALIDATION_ERROR",
    400,
    "Legal source type is invalid.",
  );
}

function expectClassification(value: unknown): DataClassification {
  if (typeof value === "string" && dataClassification.includes(value as never)) {
    return value as DataClassification;
  }

  throw new AppHttpException(
    "DOCUMENT_CLASSIFICATION_REQUIRED",
    400,
    "Legal import classification is required.",
  );
}

function expectString(value: unknown, message: string) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new AppHttpException("VALIDATION_ERROR", 400, message);
  }

  return value.trim();
}

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new AppHttpException(
      "VALIDATION_ERROR",
      400,
      "Request body must be a JSON object.",
    );
  }

  return value as Record<string, unknown>;
}

function asLooseRecord(value: unknown, message: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new AppHttpException("VALIDATION_ERROR", 400, message);
  }

  return value as Record<string, unknown>;
}

function requestMeta(request: LexframeRequest) {
  return {
    requestId: request.headers["x-request-id"] ?? null,
    traceId: request.headers["x-trace-id"] ?? null,
  };
}
