import { ForbiddenException, Injectable } from "@nestjs/common";
import Captcha20230305, {
  VerifyIntelligentCaptchaRequest,
} from "@alicloud/captcha20230305";
import { $OpenApiUtil } from "@alicloud/openapi-core";
import { IntegrationsService } from "./integrations.service";

const SLUG = "aliyun-captcha";

function captchaEndpoint(region: string): string {
  return region === "sgp"
    ? "captcha.ap-southeast-1.aliyuncs.com"
    : "captcha.cn-shanghai.aliyuncs.com";
}

/** 阿里云验证码 2.0 服务端校验 */
@Injectable()
export class AliyunCaptchaService {
  constructor(private readonly integrations: IntegrationsService) {}

  async isRequired(): Promise<boolean> {
    return this.integrations.isActive(SLUG);
  }

  /** 校验 CaptchaVerifyParam；未启用验证码时直接通过 */
  async verify(captchaVerifyParam: string | undefined): Promise<void> {
    if (!(await this.isRequired())) return;

    const accessKeyId = await this.integrations.resolveSecret(SLUG, "accessKeyId");
    const accessKeySecret = await this.integrations.resolveSecret(
      SLUG,
      "accessKeySecret",
    );
    if (!accessKeyId || !accessKeySecret) return;

    if (!captchaVerifyParam?.trim()) {
      throw new ForbiddenException("请完成人机验证");
    }

    const region =
      (await this.integrations.resolveConfig(SLUG, "region"))?.trim() || "cn";
    const sceneId = await this.integrations.resolveConfig(SLUG, "sceneId");

    const client = new Captcha20230305(
      new $OpenApiUtil.Config({
        accessKeyId,
        accessKeySecret,
        endpoint: captchaEndpoint(region),
      }),
    );

    const request = new VerifyIntelligentCaptchaRequest({
      captchaVerifyParam: captchaVerifyParam.trim(),
      sceneId: sceneId ?? undefined,
    });

    try {
      const response = await client.verifyIntelligentCaptcha(request);
      const body = response.body;
      if (!body?.success || !body.result?.verifyResult) {
        throw new ForbiddenException("人机验证失败，请重试");
      }
    } catch (error) {
      if (error instanceof ForbiddenException) throw error;
      throw new ForbiddenException("人机验证服务暂不可用");
    }
  }
}
