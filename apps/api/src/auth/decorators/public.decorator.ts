import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/** 标注该路由无需登录即可访问（例如面向官网的只读接口）。 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
