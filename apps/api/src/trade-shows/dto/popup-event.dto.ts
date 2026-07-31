import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

export class PopupEventDto {
  @ApiProperty({ enum: ['view', 'click'], description: '事件类型：曝光 | CTA 点击' })
  @IsIn(['view', 'click'])
  type!: 'view' | 'click';
}
