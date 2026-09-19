import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import configuration, { AppConfig } from './config/configuration';
import { AgentModule } from './agent/agent.module';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { ScopesGuard } from './auth/scopes.guard';
import { DbModule } from './db/db.module';
import { HealthController } from './health/health.controller';
import { McpModule } from './mcp/mcp.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService<{ app: AppConfig }, true>) => {
        const rateLimit = configService.get('app', { infer: true }).rateLimit;
        return {
          throttlers: [{ ttl: rateLimit.ttlMs, limit: rateLimit.limit }],
        };
      },
    }),
    AuthModule,
    DbModule,
    McpModule,
    AgentModule,
  ],
  controllers: [HealthController],
  providers: [
    // Throttling before auth: an unauthenticated flood hits the cheaper
    // guard first.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    // After JwtAuthGuard, which is what puts the `scope` claim on the
    // request this one reads. Guards run in registration order.
    { provide: APP_GUARD, useClass: ScopesGuard },
  ],
})
export class AppModule {}
