import type { LexframeRequest } from '../types/lexframe-request';
import { Reflector } from '@nestjs/core';
import { AppHttpException } from '../errors/app-http.exception';
import { PermissionGuard } from './permission.guard';

describe('PermissionGuard', () => {
  function createContext(request: LexframeRequest) {
    return {
      getHandler: () => PermissionGuard,
      getClass: () => PermissionGuard,
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    };
  }

  function expectAppError(
    callback: () => boolean,
    code: string,
    status: number,
  ) {
    try {
      callback();
      throw new Error('Expected AppHttpException to be thrown.');
    } catch (error) {
      expect(error).toBeInstanceOf(AppHttpException);
      expect((error as AppHttpException).code).toBe(code);
      expect((error as AppHttpException).getStatus()).toBe(status);
    }
  }

  it('throws when a route requires workspace context but none is attached', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(['workspace.invite']),
    } as unknown as Reflector;
    const guard = new PermissionGuard(reflector);

    expectAppError(
      () =>
        guard.canActivate(
          createContext({
            method: 'POST',
            url: '/workspaces/ws_1/invitations',
            headers: {},
            params: {
              workspaceId: 'ws_1',
            },
          }) as never,
        ),
      'WORKSPACE_CONTEXT_REQUIRED',
      403,
    );
  });

  it('throws when at least one required permission is missing', () => {
    const reflector = {
      getAllAndOverride: jest
        .fn()
        .mockReturnValue(['workspace.invite', 'audit.read']),
    } as unknown as Reflector;
    const guard = new PermissionGuard(reflector);

    expectAppError(
      () =>
        guard.canActivate(
          createContext({
            method: 'GET',
            url: '/audit/events',
            headers: {},
            params: {},
            lexframe: {
              access: {
                activeWorkspace: {
                  id: 'ws_1',
                  slug: 'workspace-1',
                  name: 'Workspace 1',
                  status: 'active',
                  role: 'admin',
                },
                roles: ['admin'],
                permissions: ['workspace.invite'],
              },
            },
          }) as never,
        ),
      'PERMISSION_DENIED',
      403,
    );
  });

  it('allows the request when the required permission set is satisfied', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(['workspace.invite']),
    } as unknown as Reflector;
    const guard = new PermissionGuard(reflector);

    const allowed = guard.canActivate(
      createContext({
        method: 'POST',
        url: '/workspaces/ws_1/invitations',
        headers: {},
        params: {
          workspaceId: 'ws_1',
        },
        lexframe: {
          access: {
            activeWorkspace: {
              id: 'ws_1',
              slug: 'workspace-1',
              name: 'Workspace 1',
              status: 'active',
              role: 'owner',
            },
            roles: ['owner'],
            permissions: ['workspace.invite', 'workspace.member.read'],
          },
        },
      }) as never,
    );

    expect(allowed).toBe(true);
  });
});
