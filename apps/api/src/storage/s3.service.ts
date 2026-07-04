// ============================================================
// TZJ API — S3-compatible Unified Storage Service
// ============================================================
// 一套 SDK 打通本地 MinIO 和线上阿里云 OSS
// - 本地: MinIO (http://localhost:9000)
// - 线上: 阿里云 OSS (https://oss-cn-hangzhou.aliyuncs.com)
// 关键: 通过环境变量切换 Endpoint, 代码逻辑零差异
// ============================================================

import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  HeadBucketCommand,
  CreateBucketCommand,
  ListObjectsV2Command,
  CopyObjectCommand,
} from "@aws-sdk/client-s3";
import type { PutObjectCommandInput } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

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
    this.bucket = this.config.get<string>("S3_BUCKET", "tzj-uploads-dev");
    this.publicDomain = this.config.get<string>(
      "S3_PUBLIC_DOMAIN",
      `http://localhost:9000/${this.bucket}`,
    );

    this.client = new S3Client({
      region: this.config.get<string>("S3_REGION", "us-east-1"),
      endpoint: this.config.get<string>("S3_ENDPOINT", "http://localhost:9000"),
      credentials: {
        accessKeyId: this.config.get<string>("S3_ACCESS_KEY_ID", "minioadmin"),
        secretAccessKey: this.config.get<string>(
          "S3_ACCESS_KEY_SECRET",
          "minioadmin",
        ),
      },
      // 强制 Path Style (MinIO 和阿里云 OSS 都支持)
      // Path:   http://domain/bucket/key
      // Virtual: http://bucket.domain/key
      forcePathStyle: true,
    });
  }

  async onModuleInit(): Promise<void> {
    await this.ensureBucket();
    this.logger.log(
      `S3 Storage initialized — bucket: ${this.bucket}, endpoint: ${this.config.get("S3_ENDPOINT")}`,
    );
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
        this.logger.warn(
          `无法创建存储桶 ${this.bucket}: ${(err as Error).message}`,
        );
      }
    }
  }

  /**
   * 上传文件
   * @param buffer 文件内容
   * @param key    存储路径 (如 "products/2024/abc.jpg")
   * @param contentType MIME 类型
   */
  async upload(
    buffer: Buffer,
    key: string,
    contentType: string,
  ): Promise<UploadResult> {
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
  async getPresignedPutUrl(
    key: string,
    contentType: string,
    expiresIn = 900,
  ): Promise<string> {
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

  /**
   * 列出指定前缀下的文件
   */
  async list(prefix: string, maxKeys = 100): Promise<string[]> {
    const result = await this.client.send(
      new ListObjectsV2Command({
        Bucket: this.bucket,
        Prefix: prefix,
        MaxKeys: maxKeys,
      }),
    );
    return (result.Contents ?? []).map((obj) => obj.Key!).filter(Boolean);
  }
}
