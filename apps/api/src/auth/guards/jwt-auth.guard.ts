import { ExecutionContext, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { AuthGuard } from "@nestjs/passport";
import { isObservable, lastValueFrom } from "rxjs";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator";

/**
 * 公开路由：有 JWT 则解析用户（后台预览/列表），无 JWT 或无效令牌仍放行。
 * 受保护路由：必须有效 JWT。
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard("jwt") {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  override async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      try {
        await this.runActivate(context);
      } catch {
        // 无 token 或 token 无效：公开访问继续，但不设置 user
      }
      return true;
    }

    return this.runActivate(context);
  }

  private async runActivate(context: ExecutionContext): Promise<boolean> {
    const result = super.canActivate(context);
    if (isObservable(result)) return lastValueFrom(result);
    if (result instanceof Promise) return result;
    return result;
  }
}
