jest.mock('jose', () => ({
  createRemoteJWKSet: jest.fn(),
  jwtVerify: jest.fn(),
}));

import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { AdminReauthGuard } from '../src/common/guards/admin-reauth.guard';
import { AuthGuard } from '../src/common/guards/auth.guard';
import { WorkspaceContextGuard } from '../src/common/guards/workspace-context.guard';

describe('AppModule', () => {
  it('creates the Stage 1 backend graph', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(WorkspaceContextGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(AdminReauthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    expect(moduleRef).toBeDefined();
  });
});
