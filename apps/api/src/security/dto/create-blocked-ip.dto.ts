import { IsIn, IsOptional, IsString, MaxLength } from "class-validator";
import type { BlockIpDuration } from "@tzj/types";

const DURATIONS: BlockIpDuration[] = ["1h", "24h", "7d", "30d", "permanent"];

export class CreateBlockedIpDto {
  @IsString()
  @MaxLength(45)
  ip!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;

  @IsOptional()
  @IsIn(DURATIONS)
  duration?: BlockIpDuration;
}
