import { Controller, Get } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { Public } from "../auth/decorators/public.decorator";
import { HealthService } from "./health.service";

@ApiTags("health")
@Controller("health")
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: "健康检查（兼容旧探针）" })
  check() {
    return this.healthService.check();
  }

  @Public()
  @Get("live")
  @ApiOperation({ summary: "存活探针（K8s liveness）" })
  live() {
    return this.healthService.live();
  }

  @Public()
  @Get("ready")
  @ApiOperation({ summary: "就绪探针（K8s readiness，含依赖）" })
  ready() {
    return this.healthService.ready();
  }
}
