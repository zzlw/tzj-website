/**
 * Favicon ICO 转换测试脚本
 * 用于验证 png-to-ico 在 Alpine Linux 环境中是否正常工作
 */

import sharp from "sharp";
import pngToIco from "png-to-ico";

async function testFaviconConversion() {
  console.log("Testing favicon conversion in Alpine environment...");
  
  // 创建一个简单的 64x64 PNG 图片
  const testPng = await sharp({
    create: {
      width: 64,
      height: 64,
      channels: 4,
      background: { r: 255, g: 0, b: 0, alpha: 1 },
    },
  })
    .png()
    .toBuffer();
  
  console.log(`Created test PNG: ${testPng.length} bytes`);
  
  try {
    // 缩放到 32x32
    const resizedPng = await sharp(testPng)
      .resize(32, 32, { fit: "cover", position: "centre" })
      .png()
      .toBuffer();
    
    console.log(`Resized to 32x32: ${resizedPng.length} bytes`);
    
    // 转换为 ICO
    const icoBuffer = await pngToIco(resizedPng);
    console.log(`✅ ICO conversion successful: ${icoBuffer.length} bytes`);
    console.log(`ICO buffer first 16 bytes: ${icoBuffer.slice(0, 16).toString('hex')}`);
    
    return true;
  } catch (error) {
    console.error("❌ ICO conversion failed:", error);
    throw error;
  }
}

// 运行测试
testFaviconConversion()
  .then(() => {
    console.log("\n✅ All tests passed!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Tests failed:", error);
    process.exit(1);
  });
