import { Module } from '@nestjs/common';
import { AnalyticsModule } from '../analytics/analytics.module';
import { IntegrationsModule } from '../integrations/integrations.module';
import { LingxiController } from './lingxi.controller';
import { LingxiAgentService } from './lingxi-agent.service';
import { LlmClient } from './llm/llm-client';

/**
 * 灵犀 AI 投放报告（docs/lingxi-ai-report-design.md）。
 * AnalyticsModule 供 M2 工具集注入 AnalyticsService / GrowthMetricsService。
 */
@Module({
  imports: [IntegrationsModule, AnalyticsModule],
  controllers: [LingxiController],
  providers: [LingxiAgentService, LlmClient],
})
export class LingxiModule {}
