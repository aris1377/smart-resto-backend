import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    return super.canActivate(context);
  }

  handleRequest(err: any, user: any, info: any) {
    // Agar token xato bo'lsa yoki berilmagan bo'lsa, aniq va tushunarli xatolik qaytaradi
    if (err || !user) {
      throw err || new UnauthorizedException('Invalid token.');
    }
    return user;
  }
}
