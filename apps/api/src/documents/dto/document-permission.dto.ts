import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsEnum, IsOptional, IsString, ValidateIf } from 'class-validator';

export enum PermissionRole {
  VIEWER = 'viewer',
  EDITOR = 'editor',
  OWNER = 'owner',
}

export enum PermissionTargetType {
  USER = 'user',
  ROLE = 'role',
  PUBLIC = 'public',
}

export class CreateDocumentPermissionDto {
  @ApiProperty({ description: '权限角色', enum: PermissionRole })
  @IsEnum(PermissionRole)
  role!: PermissionRole;

  @ApiProperty({ description: '目标类型', enum: PermissionTargetType })
  @IsEnum(PermissionTargetType)
  targetType!: PermissionTargetType;

  @ApiPropertyOptional({ description: '目标ID（用户ID或角色slug，public时为空）' })
  @ValidateIf((o) => o.targetType !== PermissionTargetType.PUBLIC)
  @IsString()
  targetId?: string | null;
}

export class UpdateDocumentPermissionDto {
  @ApiPropertyOptional({ description: '权限角色', enum: PermissionRole })
  @IsOptional()
  @IsEnum(PermissionRole)
  role?: PermissionRole;
}

export class BatchUpdatePermissionsDto {
  @ApiProperty({ type: [CreateDocumentPermissionDto], description: '权限列表' })
  @IsArray()
  permissions!: CreateDocumentPermissionDto[];
}

export class DocumentPermissionItem {
  id!: string;
  documentId!: string;
  role!: PermissionRole;
  targetType!: PermissionTargetType;
  targetId!: string | null;
  targetName?: string | null; // 用户名或角色名
  grantedBy?: string | null;
  grantorName?: string | null;
  createdAt!: string;
  updatedAt!: string;
}

export class DocumentAccessInfo {
  canView!: boolean;
  canEdit!: boolean;
  isOwner!: boolean;
  permissions!: DocumentPermissionItem[];
}
