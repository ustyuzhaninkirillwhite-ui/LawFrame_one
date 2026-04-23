import fastifyCors from '@fastify/cors';
import { loadServerEnv } from '@lexframe/config';
import { createLogger } from '@lexframe/logger';
import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { ErrorMappingFilter } from './common/filters/error-mapping.filter';
import { AuditInterceptor } from './common/interceptors/audit.interceptor';
import { AppModule } from './app.module';

async function bootstrap() {
  const env = loadServerEnv();
  const bootstrapLogger = createLogger('backend.bootstrap');

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({
      logger: false,
    }),
  );

  await app.register(fastifyCors, {
    origin: true,
  });

  app.useGlobalFilters(new ErrorMappingFilter());
  app.useGlobalInterceptors(
    new AuditInterceptor(createLogger('backend.audit')),
  );

  await app.listen(env.PORT, '0.0.0.0');
  bootstrapLogger.info('LexFrame Stage 0 backend started', {
    port: env.PORT,
    mode: env.NODE_ENV,
  });
}

void bootstrap();
