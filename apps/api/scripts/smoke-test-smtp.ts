/**
 * SMTP 冒烟测试脚本（阶段 2 步骤 8）
 *
 * 用途：用 nodemailer 直连 smtp.qiye.aliyun.com:465，以 service@tzjii.com
 *       发送一封测试邮件，验证阿里企业邮箱免费版 SMTP 发信能力。
 *
 * 前置：
 *   1. 企业邮箱免费版已开通，tzjii.com 域名验证通过
 *   2. service@tzjii.com 账号已创建
 *   3. 域管已开启「三方客户端登录管理」
 *   4. service@ 已生成三方客户端安全密码
 *
 * 运行：
 *   SMTP_PASSWORD=<三方客户端安全密码> pnpm --filter @tzj/api tsx scripts/smoke-test-smtp.ts
 *
 * 若发送失败且错误为 526/535 → 检查密码或三方客户端开关
 * 若连接超时 → 检查生产 ECS 465 端口出站连通性
 */

import nodemailer from 'nodemailer';

const SMTP_HOST = 'smtp.qiye.aliyun.com';
const SMTP_PORT = 465;
const ACCOUNT = 'service@tzjii.com';

async function main() {
  const password = process.env.SMTP_PASSWORD;
  if (!password) {
    console.error('❌ 缺少环境变量 SMTP_PASSWORD（三方客户端安全密码）');
    console.error(
      '   用法: SMTP_PASSWORD=<密码> pnpm --filter @tzj/api tsx scripts/smoke-test-smtp.ts',
    );
    process.exit(1);
  }

  const recipient = process.env.TEST_RECIPIENT || 'service@tzjii.com';

  console.log(`\n🔌 连接 ${SMTP_HOST}:${SMTP_PORT} (SSL)...`);
  console.log(`📧 发件人: ${ACCOUNT}`);
  console.log(`📬 收件人: ${recipient}\n`);

  const transport = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: true,
    connectionTimeout: 10_000,
    socketTimeout: 15_000,
    auth: { user: ACCOUNT, pass: password },
  });

  try {
    // 1. 验证连接 + 认证
    console.log('⏳ SMTP 握手...');
    await transport.verify();
    console.log('✅ SMTP 连接 + 认证成功\n');

    // 2. 发送测试邮件
    const info = await transport.sendMail({
      from: `"拓之迹官网" <${ACCOUNT}>`,
      to: recipient,
      subject: `[SMTP 冒烟测试] ${new Date().toISOString()}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1a56db;">🎉 SMTP 冒烟测试成功</h2>
          <p>这是一封来自 <strong>拓之迹官网</strong> 邮件系统的测试邮件。</p>
          <p>如果您在 <code>${recipient}</code> 的收件箱中看到此邮件，说明阿里企业邮箱免费版 SMTP 发信能力正常。</p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
          <p style="color: #6b7280; font-size: 12px;">
            发送时间：${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}<br />
            发件服务器：${SMTP_HOST}:${SMTP_PORT} (SSL)<br />
            发件账号：${ACCOUNT}
          </p>
        </div>
      `,
      text: `SMTP 冒烟测试成功 — 来自拓之迹官网邮件系统 (${new Date().toISOString()})`,
    });

    console.log(`✅ 邮件发送成功！Message ID: ${info.messageId}`);
    console.log(`\n📋 下一步：`);
    console.log(`   1. 检查 ${recipient} 收件箱（含垃圾邮件文件夹）`);
    console.log(`   2. 确认邮件内容正常显示`);
    console.log(`   3. 尝试直接回复此邮件 → 检查 service@ webmail 是否收到`);
  } catch (error) {
    const msg = (error as Error).message;
    console.error(`❌ 发送失败: ${msg}`);

    if (/535|526|auth/i.test(msg)) {
      console.error('\n💡 诊断：认证失败');
      console.error('   - 检查三方客户端安全密码是否正确');
      console.error('   - 检查域管是否已开启「三方客户端登录管理」');
      console.error('   - 注意：安全密码 ≠ 登录密码，需在个人邮箱 webmail 中生成');
    } else if (/ECONNREFUSED|ETIMEDOUT|ENOTFOUND/i.test(msg)) {
      console.error('\n💡 诊断：网络不通');
      console.error(`   - 检查 ${SMTP_HOST}:${SMTP_PORT} 出站连通性`);
      console.error('   - 运行: openssl s_client -connect smtp.qiye.aliyun.com:465');
    }

    process.exit(1);
  } finally {
    transport.close();
  }
}

main();
