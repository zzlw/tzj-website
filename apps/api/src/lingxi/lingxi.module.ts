import { Module } from '@nestjs/common';
import { AnalyticsModule } from '../analytics/analytics.module';
import { IntegrationsModule } from '../integrations/integrations.module';
import { LingxiController } from './lingxi.controller';
import { LingxiAgentService } from './lingxi-agent.service';
import { LingxiToolsService } from './lingxi-tools.service';
import { LlmClient } from './llm/llm-client';
import { RunBufferRegistry } from './run-buffer';

/**
 * 灵犀 AI 投放报告（docs/lingxi-ai-report-design.md）。
 * AnalyticsModule 提供 AnalyticsService / GrowthMetricsService 供工具集直调，
 * 报表页与 AI 报告口径永远一致。
 */
@Module({
  imports: [IntegrationsModule, AnalyticsModule],
  controllers: [LingxiController],
  providers: [LingxiAgentService, LingxiToolsService, LlmClient, RunBufferRegistry],
})
export class LingxiModule {}
