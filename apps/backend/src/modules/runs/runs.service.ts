import type { CreateRunArtifactRequest } from '@lexframe/contracts';
import type {
  AccessContext,
  AuthenticatedActor,
} from '../../common/types/lexframe-request';
import { Injectable } from '@nestjs/common';
import { DocumentsService } from '../documents/documents.service';
import { RunSnapshotService } from './run-snapshot.service';

interface RequestMeta {
  readonly requestId: string | null;
  readonly traceId: string | null;
}

@Injectable()
export class RunsService {
  constructor(
    private readonly documentsService: DocumentsService,
    private readonly runSnapshotService: RunSnapshotService,
  ) {}

  async list(access: AccessContext) {
    return this.runSnapshotService.listRuns(access);
  }

  listArtifacts(access: AccessContext, runId: string) {
    return this.documentsService.listRunArtifacts(
      access.activeWorkspace!.id,
      runId,
    );
  }

  createArtifact(
    actor: AuthenticatedActor,
    access: AccessContext,
    runId: string,
    input: CreateRunArtifactRequest,
    meta: RequestMeta,
  ) {
    return this.documentsService.createRunArtifact(
      actor,
      access,
      runId,
      input,
      meta,
    );
  }
}
