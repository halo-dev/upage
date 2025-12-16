import { v4 as uuidv4 } from 'uuid';
/**
 * 生成符合 RFC 4122 标准的 UUID v4
 * 格式类似于: ea7ae54b-a116-4564-b805-f97fe211d4dd
 * @returns {string} 生成的 UUID 字符串
 */
export function generateUUID(): string {
  return uuidv4();
}

/**
 * 生成不带连字符的 UUID
 * 格式类似于: ea7ae54ba1164564b805f97fe211d4dd
 * @returns {string} 生成的无连字符 UUID 字符串
 */
export function generateCompactUUID(): string {
  return generateUUID().replace(/-/g, '');
}
