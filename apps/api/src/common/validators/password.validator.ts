import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

/**
 * 常见弱密码黑名单（全小写比对）。
 * 来源：OWASP Top 100 + 国内常见弱口令。
 */
const COMMON_PASSWORDS = new Set([
  'password',
  'password1',
  'password123',
  'pass123',
  'admin',
  'admin123',
  'admin1234',
  'admin12345',
  'administrator',
  'root',
  'root123',
  '123456',
  '12345678',
  '123456789',
  '1234567890',
  'qwerty',
  'qwerty123',
  'abc123',
  'iloveyou',
  'letmein',
  'welcome',
  'monkey',
  'dragon',
  'master',
  'login',
  'princess',
  'football',
  'shadow',
  'sunshine',
  'trustno1',
  '654321',
  'superman',
  'batman',
  'test',
  'test123',
  'guest',
  'changeme',
  'p@ssw0rd',
  'passw0rd',
  'a123456',
  'aa123456',
  '111111',
  '000000',
  '888888',
  '666666',
]);

/**
 * 密码强度规则：
 * 1. 最少 8 位，最长 128 位
 * 2. 必须包含以下 3 类中的至少 2 类：大写字母、小写字母、数字
 * 3. 不得命中常见弱密码黑名单
 */
@ValidatorConstraint({ name: 'strongPassword', async: false })
export class StrongPasswordConstraint implements ValidatorConstraintInterface {
  validate(password: unknown): boolean {
    if (typeof password !== 'string') return false;
    if (password.length < 8 || password.length > 128) return false;

    // 黑名单检测（忽略大小写）
    if (COMMON_PASSWORDS.has(password.toLowerCase())) return false;

    // 字符类型计数
    let types = 0;
    if (/[a-z]/.test(password)) types++;
    if (/[A-Z]/.test(password)) types++;
    if (/\d/.test(password)) types++;
    // 特殊字符作为加分项，不强制
    return types >= 2;
  }

  defaultMessage(args: ValidationArguments): string {
    const pwd = args.value as string;
    if (typeof pwd !== 'string' || pwd.length < 8) {
      return '密码长度至少 8 位';
    }
    if (pwd.length > 128) {
      return '密码长度不能超过 128 位';
    }
    if (COMMON_PASSWORDS.has(pwd.toLowerCase())) {
      return '密码过于常见，请使用更复杂的密码';
    }
    return '密码须包含大写字母、小写字母、数字中的至少两类';
  }
}

/**
 * 自定义装饰器：@IsStrongPassword()
 *
 * 用法：
 * ```ts
 * class CreateUserDto {
 *   @IsStrongPassword()
 *   password!: string;
 * }
 * ```
 */
export function IsStrongPassword(validationOptions?: ValidationOptions) {
  return (object: object, propertyName: string) => {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      constraints: [],
      validator: StrongPasswordConstraint,
    });
  };
}
