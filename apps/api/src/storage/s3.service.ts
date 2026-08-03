// ============================================================
// TZJ API — S3-compatible Unified Storage Service
// ============================================================
// 一套 SDK 打通本地 MinIO 和线上自托管 MinIO
// - 本地: MinIO (http://localhost:9000)
// - 线上: MinIO 经 nginx 反代 (https://static.tzjii.com)
// 关键: 通过环境变量切换 Endpoint, 代码逻辑零差异
// ============================================================

import { randomUUID } from 'node:crypto';
import type { PutObjectCommandInput } from '@aws-sdk/client-s3';
import {
  CopyObjectCommand,
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutBucketPolicyCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface UploadResult {
  key: string;
  url: string;
  size: number;
  contentType: string;
}

@Injectable()
export class S3Service implements OnModuleInit {
  private readonly logger = new Logger(S3Service.name);
  private client: S3Client;
  private readonly bucket: string;
  private readonly publicDomain: string;

  constructor(private readonly config: ConfigService) {
    this.bucket = this.config.get<string>('S3_BUCKET', 'tzj-uploads-dev');
    this.publicDomain = this.config.get<string>(
      'S3_PUBLIC_DOMAIN',
      `http://localhost:9000/${this.bucket}`,
    );

    this.client = new S3Client({
      region: this.config.get<string>('S3_REGION', 'us-east-1'),
      endpoint: this.config.get<string>('S3_ENDPOINT', 'http://localhost:9000'),
      credentials: {
        accessKeyId: this.config.get<string>('S3_ACCESS_KEY_ID', 'minioadmin'),
        secretAccessKey: this.config.get<string>('S3_ACCESS_KEY_SECRET', 'minioadmin'),
      },
      // MinIO 使用 Path Style, 阿里云 OSS 等使用 Virtual Hosted Style
      // Path:   http://domain/bucket/key (MinIO)
      // Virtual: http://bucket.domain/key (OSS)
      // 生产端点（如 https://static.tzjii.com）不含 localhost/minio，由显式开关控制
      forcePathStyle:
        this.config.get<string>('S3_FORCE_PATH_STYLE') === 'true' ||
        this.config.get<string>('S3_ENDPOINT', '').includes('localhost') ||
        this.config.get<string>('S3_ENDPOINT', '').includes('minio'),
    });
  }

  async onModuleInit(): Promise<void> {
    // 异步初始化存储桶，不阻塞应用启动
    // 如果 S3/MinIO/OSS 未就绪，后续请求会自动重试或返回错误
    this.ensureBucket().catch((err) => {
      this.logger.warn(
        `S3 bucket initialization failed (will retry on next request): ${(err as Error).message}`,
      );
    });
    this.logger.log(
      `S3 Storage module loaded — bucket: ${this.bucket}, endpoint: ${this.config.get('S3_ENDPOINT')}`,
    );
  }

  /** 健康探针：检查存储桶是否可访问 */
  async ping(): Promise<boolean> {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
      return true;
    } catch {
      return false;
    }
  }

  /** 存储桶不存在时自动创建（本地 MinIO 便于开箱即用）。 */
  private async ensureBucket(): Promise<void> {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
    } catch {
      try {
        await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }));
        this.logger.log(`已创建存储桶: ${this.bucket}`);
      } catch (err) {
        this.logger.warn(`无法创建存储桶 ${this.bucket}: ${(err as Error).message}`);
      }
    }

    // 仅非生产环境自动放开公开读，方便前端用公开 URL 直接访问媒体（MinIO 本地 / 预发）。
    // 生产（OSS）的公开读由云控制台 / 部署脚本的 bucket policy 管理，不在应用内处理。
    if (this.config.get<string>('NODE_ENV', 'development') !== 'production') {
      await this.ensurePublicRead().catch((err) =>
        this.logger.warn(`设置公开读策略失败（可忽略）: ${(err as Error).message}`),
      );
    }
  }

  /** 设置 bucket 公开读（仅 dev / 非生产）：允许匿名 GET 对象。 */
  private async ensurePublicRead(): Promise<void> {
    const policy = {
      Version: '2012-10-17',
      Statement: [
        {
          Effect: 'Allow',
          Principal: '*',
          Action: ['s3:GetObject'],
          Resource: [`arn:aws:s3:::${this.bucket}/*`],
        },
      ],
    };
    await this.client.send(
      new PutBucketPolicyCommand({
        Bucket: this.bucket,
        Policy: JSON.stringify(policy),
      }),
    );
    this.logger.log(`已为存储桶 ${this.bucket} 设置公开读策略（dev）`);
  }

  /**
   * 上传文件
   * @param buffer 文件内容
   * @param key    存储路径 (如 "products/2024/abc.jpg")
   * @param contentType MIME 类型
   */
  async upload(buffer: Buffer, key: string, contentType: string): Promise<UploadResult> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      }),
    );

    return {
      key,
      url: this.getUrl(key),
      size: buffer.length,
      contentType,
    };
  }

  /** 同桶内复制对象（用于站点资源替换前备份）。 */
  async copy(sourceKey: string, destKey: string): Promise<void> {
    await this.client.send(
      new CopyObjectCommand({
        Bucket: this.bucket,
        CopySource: `${this.bucket}/${sourceKey}`,
        Key: destKey,
      }),
    );
  }

  /**
   * 删除文件
   */
  async delete(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }),
    );
  }

  /**
   * 获取文件公开访问 URL
   */
  getUrl(key: string): string {
    return `${this.publicDomain}/${key}`;
  }

  /**
   * 构造聊天附件的不可猜测对象 key。
   * 结构：chat/{YYYYMM}/{roomId}/{uuid}-{sanitized-name}
   * - 用 uuid 前缀避免原文件名暴露 / 路径穿越
   * - 按月份 + 房间分目录，便于生命周期与批量清理
   */
  buildChatKey(roomId: string, fileName: string): string {
    const ym = new Date().toISOString().slice(0, 7).replace('-', '');
    const sanitized = fileName.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80);
    const uuid = randomUUID();
    return `chat/${ym}/${roomId}/${uuid}-${sanitized}`;
  }

  /**
   * 生成预签名 URL (临时访问私有文件)
   * @param key 文件路径
   * @param expiresIn 过期秒数 (默认 1 小时)
   */
  async getPresignedUrl(key: string, expiresIn = 3600): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });
    return getSignedUrl(this.client, command, { expiresIn });
  }

  /**
   * 生成预签名上传 URL（浏览器直传 PUT）。
   * 需要存储桶已配置允许来自后台域名的 CORS PUT。
   */
  async getPresignedPutUrl(key: string, contentType: string, expiresIn = 900): Promise<string> {
    const input: PutObjectCommandInput = {
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
    };
    return getSignedUrl(this.client, new PutObjectCommand(input), {
      expiresIn,
    });
  }

  /**
   * 检查文件是否存在
   */
  async exists(key: string): Promise<boolean> {
    try {
      await this.client.send(
        new HeadObjectCommand({
          Bucket: this.bucket,
          Key: key,
        }),
      );
      return true;
    } catch {
      return false;
    }
  }

  /** 获取对象元信息（大小 + MIME），不下载内容 */
  async head(key: string): Promise<{ contentLength: number; contentType: string }> {
    const result = await this.client.send(
      new HeadObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }),
    );
    return {
      contentLength: result.ContentLength ?? 0,
      contentType: result.ContentType ?? 'application/octet-stream',
    };
  }

  /**
   * 下载对象内容为 Buffer（用于水印 Logo 等）
   */
  async getObjectBuffer(key: string): Promise<Buffer> {
    const result = await this.client.send(
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }),
    );
    const body = result.Body;
    if (!body) throw new Error(`对象为空: ${key}`);
    const chunks: Uint8Array[] = [];
    for await (const chunk of body as AsyncIterable<Uint8Array>) {
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  }

  /**
   * 列出指定前缀下的文件（自动翻页直到列完）。
   * @param maxKeys 每页上限（S3 单次最大 1000），翻页由 ContinuationToken 驱动
   */
  async list(prefix: string, maxKeys = 100): Promise<string[]> {
    const keys: string[] = [];
    let token: string | undefined;
    do {
      const result = await this.client.send(
        new ListObjectsV2Command({
          Bucket: this.bucket,
          Prefix: prefix,
          MaxKeys: maxKeys,
          ContinuationToken: token,
        }),
      );
      keys.push(...(result.Contents ?? []).map((obj) => obj.Key!).filter(Boolean));
      token = result.IsTruncated ? result.NextContinuationToken : undefined;
    } while (token);
    return keys;
  }
}
