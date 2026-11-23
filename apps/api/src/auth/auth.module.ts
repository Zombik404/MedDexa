import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import type { Env } from '../config/env';
import { MailService } from '../mail/mail.service';
import { AuthController } from './auth.controller';
import { AuthGuard } from './auth.guard';
import { AuthService } from './auth.service';

@Global()
@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        secret: config.get('JWT_ACCESS_SECRET', { infer: true }),
        signOptions: { issuer: 'meddexa', audience: 'meddexa-api' },
        verifyOptions: { issuer: 'meddexa', audience: 'meddexa-api' },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, MailService, { provide: APP_GUARD, useClass: AuthGuard }],
  exports: [AuthService, MailService],
})
export class AuthModule {}
