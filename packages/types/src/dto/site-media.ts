/** 水印布局：角标 / 平铺斜纹 / 居中样片 */
export type WatermarkLayout = 'corner' | 'tile' | 'center';

/** 水印位置（layout=corner 时生效） */
export type WatermarkPosition =
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right'
  | 'center';

/** 水印类型：文字或 Logo 图片 */
export type WatermarkMode = 'text' | 'image';

/** 可加水印的媒体库目录（不含 content 站点静态资源） */
export type WatermarkFolder = 'uploads' | 'cms';

/** 后台媒体处理设置（不暴露给 C 端） */
export interface SiteMediaSettings {
  watermark: {
    /** 是否在上传时自动加水印 */
    enabled: boolean;
    /** 布局：角标（品牌）、平铺（防盗）、居中（样片/预览） */
    layout: WatermarkLayout;
    mode: WatermarkMode;
    /** 文字水印内容（mode=text 时使用） */
    text: string;
    /** Logo 对象 key，如 uploads/watermark.png（mode=image 时使用） */
    imageKey?: string;
    /** 不透明度 0.05–1 */
    opacity: number;
    /** 角标位置（layout=corner） */
    position: WatermarkPosition;
    /** 水印宽度占原图/视频宽度的比例 0.05–0.5 */
    scale: number;
    /** 平铺间距倍率 1.0–2.5（layout=tile） */
    tileSpacing: number;
    /** 平铺旋转角度 -45～-10（layout=tile） */
    tileAngle: number;
    /** 短边低于此像素时不加水印，避免小图糊成一团 */
    minWidth: number;
    minHeight: number;
    applyToImages: boolean;
    /** 需服务器安装 ffmpeg；未安装时自动跳过 */
    applyToVideos: boolean;
    applyToFolders: WatermarkFolder[];
  };
}

export const WATERMARK_LAYOUT_LABELS: Record<WatermarkLayout, string> = {
  corner: '角标（品牌标识）',
  tile: '平铺斜纹（防盗图）',
  center: '居中样片',
};

export const WATERMARK_POSITION_LABELS: Record<WatermarkPosition, string> = {
  'top-left': '左上',
  'top-right': '右上',
  'bottom-left': '左下',
  'bottom-right': '右下',
  center: '居中',
};
