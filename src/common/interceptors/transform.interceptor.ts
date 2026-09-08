import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Response as ExpressResponse } from 'express';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface ApiResponse<T> {
  success: boolean;
  statusCode: number;
  message: string;
  data: T;
  timestamp: string;
}

interface WrappedPayload {
  message?: string;
  data?: unknown;
}

function isWrapped(value: unknown): value is WrappedPayload {
  return (
    typeof value === 'object' &&
    value !== null &&
    ('message' in value || 'data' in value)
  );
}

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<
  T,
  ApiResponse<T>
> {
  intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<ApiResponse<T>> {
    const { statusCode } = context
      .switchToHttp()
      .getResponse<ExpressResponse>();

    return next.handle().pipe(
      map((payload) => ({
        success: true,
        statusCode,
        message: isWrapped(payload)
          ? (payload.message ?? 'Success')
          : 'Success',
        data: (isWrapped(payload) && payload.data !== undefined
          ? payload.data
          : payload) as T,
        timestamp: new Date().toISOString(),
      })),
    );
  }
}
