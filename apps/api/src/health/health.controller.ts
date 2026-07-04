import { Controller, Get } from "@nestjs/common";
import { ApiTags, ApiOperation } from "@nestjs/swagger";
import { PrismaService } from "../prisma/prisma.service";
import { Public } from "../auth/decorators/public.decorator";

@ApiTags("health")
@Controller("health")
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: "健康检查" })
  async check() {
    let dbStatus = "ok";
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      dbStatus = "error";
    }

    return {
      status: dbStatus === "ok" ? "healthy" : "degraded",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      checks: {
        database: dbStatus,
        memory: {
          rss: `${Math.round(process.memoryUsage().rss / 1024 / 1024)}MB`,
          heap: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`,
        },
      },
    };
  }
}
