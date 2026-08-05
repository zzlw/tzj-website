/**
 * @amplitude/ua-parser-js 是 ua-parser-js@0.7 的 MIT fork，构造函数与返回结构完全兼容。
 * 社区没有独立的 @types/amplitude__ua-parser-js，桥接到 @types/ua-parser-js。
 */
declare module '@amplitude/ua-parser-js' {
  import UAParser = require('ua-parser-js');

  export = UAParser;
}
