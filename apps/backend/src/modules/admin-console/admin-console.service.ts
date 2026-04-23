import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { SecretsService } from '../secrets/secrets.service';
import { SecurityOperationsService } from '../security-operations/security-operations.service';

@Injectable()
export class AdminConsoleService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly secretsService: SecretsService,
    private readonly securityOperationsService: SecurityOperationsService,
  ) {}

  async getOverview(workspaceId: string | null) {
    const [secrets, alerts, incidents, gates] = await Promise.all([
      this.secretsService.listInventory(),
      this.securityOperationsService.listAlerts(workspaceId),
      this.securityOperationsService.listIncidents(workspaceId),
      this.databaseService.query<{
        readonly gate_code: string;
        readonly title: string;
        readonly severity: string;
        readonly required: boolean;
        readonly owner: string;
        readonly latest_status: string | null;
      }>(
        `
          select gate_code, title, severity, required, owner, latest_status
          from api.stage11_security_overview
          order by gate_code asc
        `,
      ),
    ]);

    return {
      secrets,
      openAlerts: alerts.filter((item) => item.status === 'open').length,
      openIncidents: incidents.filter((item) => item.status !== 'closed')
        .length,
      releaseGates: gates.rows,
      criticalAlerts: alerts.filter((item) => item.severity === 'critical'),
    };
  }
}
