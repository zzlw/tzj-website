import { IsBoolean, IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export enum TicketCategory {
  GENERAL_INQUIRY = 'general-inquiry',
  TECHNICAL_SUPPORT = 'technical-support',
  ACCOUNT_ISSUE = 'account-issue',
  TRADING_ISSUE = 'trading-issue',
  BILLING = 'billing',
  BUG_REPORT = 'bug-report',
  FEATURE_REQUEST = 'feature-request',
}

export enum TicketPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent',
}

export class CreateTicketDto {
  @IsNotEmpty()
  @IsString()
  subject!: string;

  @IsNotEmpty()
  @IsString()
  message!: string;

  @IsOptional()
  @IsEnum(TicketCategory)
  category?: TicketCategory;

  @IsOptional()
  @IsEnum(TicketPriority)
  priority?: TicketPriority;

  @IsOptional()
  @IsBoolean()
  isAnonymous?: boolean;

  @IsOptional()
  @IsEmail()
  anonymousEmail?: string;

  @IsOptional()
  @IsString()
  anonymousName?: string;
}

export class CreateCommentDto {
  @IsNotEmpty()
  @IsString()
  message!: string;

  @IsOptional()
  @IsBoolean()
  isInternal?: boolean;

  @IsOptional()
  @IsString()
  author?: string;
}

export class UpdateTicketDto {
  @IsOptional()
  @IsString()
  subject?: string;

  @IsOptional()
  @IsEnum(TicketCategory)
  category?: TicketCategory;

  @IsOptional()
  @IsEnum(TicketPriority)
  priority?: TicketPriority;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  assignedTo?: string;
}
