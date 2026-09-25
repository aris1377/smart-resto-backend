import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | object = 'Internal server error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else {
        const body = exceptionResponse as { message?: string | string[] };
        message = body.message ?? exceptionResponse;
      }
    }

    // Kutilmagan xatoning matni mijozga chiqmaydi (ichki tafsilot oshkor
    // boʻlmasin) — logga esa toʻliq holicha yoziladi
    let logMessage: string;

    if (exception instanceof HttpException) {
      logMessage = JSON.stringify(message);
    } else if (exception instanceof Error) {
      logMessage = exception.message;
    } else {
      logMessage = 'Nomaʼlum xato turi';
    }

    this.logger.error(
      `HTTP Status: ${status} | Path: ${request.url} | Error: ${logMessage}`,
      (exception as Error)?.stack,
    );

    response.status(status).json({
      success: false,
      statusCode: status,
      path: request.url,
      message: message,
      timestamp: new Date().toISOString(),
    });
  }
}
