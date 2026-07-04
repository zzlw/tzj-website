import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { Request, Response } from "express";

interface ErrorBody {
  code: string;
  message: string | string[];
  details?: unknown;
}

/**
 * 统一错误响应：
 * { success: false, error: { code, message, details? }, traceId, timestamp, path }
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger("Exception");

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request & { id?: string }>();
    const traceId = request?.id;

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const error = this.buildError(exception, status);

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `[${traceId ?? "-"}] ${request?.method} ${request?.url} -> ${status}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    response.status(status).json({
      success: false,
      error,
      traceId,
      path: request?.url,
      timestamp: new Date().toISOString(),
    });
  }

  private buildError(exception: unknown, status: number): ErrorBody {
    if (exception instanceof HttpException) {
      const res = exception.getResponse();
      if (typeof res === "object" && res !== null) {
        const r = res as Record<string, unknown>;
        return {
          code: (r.error as string) ?? this.codeFromStatus(status),
          message: (r.message as string | string[]) ?? exception.message,
          details: r.details,
        };
      }
      return { code: this.codeFromStatus(status), message: String(res) };
    }
    return {
      code: this.codeFromStatus(status),
      message:
        process.env.NODE_ENV === "production"
          ? "Internal server error"
          : exception instanceof Error
            ? exception.message
            : "Internal server error",
    };
  }

  private codeFromStatus(status: number): string {
    return (
      HttpStatus[status] ?? (status >= 500 ? "INTERNAL_ERROR" : "ERROR")
    ).toString();
  }
}
