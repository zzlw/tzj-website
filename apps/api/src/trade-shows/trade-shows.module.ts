import { Module } from "@nestjs/common";
import { TradeShowsController } from "./trade-shows.controller";
import { TradeShowsService } from "./trade-shows.service";

@Module({
  controllers: [TradeShowsController],
  providers: [TradeShowsService],
  exports: [TradeShowsService],
})
export class TradeShowsModule {}
