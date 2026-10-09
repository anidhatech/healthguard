import { Global, Module } from '@nestjs/common';
import { AuthController } from './auth.controller.js';
import { AuthGuard } from './auth.guard.js';
import { AuthService } from './auth.service.js';
import { SessionService } from './session.service.js';
import { TokenService } from './token.service.js';

@Global()
@Module({
  controllers: [AuthController],
  providers: [AuthService, SessionService, TokenService, AuthGuard],
  exports: [SessionService, TokenService, AuthGuard],
})
export class AuthModule {}
