export const MAX_FILES = 1000;

export const isBinaryFile = async (file: File): Promise<boolean> => {
  const chunkSize = 1024;
  const buffer = new Uint8Array(await file.slice(0, chunkSize).arrayBuffer());

  for (let i = 0; i < buffer.length; i++) {
    const byte = buffer[i];

    if (byte === 0 || (byte < 32 && byte !== 9 && byte !== 10 && byte !== 13)) {
      return true;
    }
  }

  return false;
};

/**
 * 检测字符串是否为二进制形式
 *
 * 通过检查字符串中是否包含控制字符（ASCII 0-31，除了制表符、换行符和回车符）
 *
 * @param str 要检测的字符串
 * @param maxLength 最大检查的字符数，默认为1024
 * @returns 如果字符串可能是二进制的，返回 true；否则返回 false
 */
export const isBinaryString = (str: string, maxLength: number = 1024): boolean => {
  // 如果字符串为空，则不是二进制
  if (!str || str.length === 0) {
    return false;
  }

  // 限制检查的长度，避免处理大字符串时性能问题
  const checkLength = Math.min(str.length, maxLength);

  // 检查是否包含控制字符
  for (let i = 0; i < checkLength; i++) {
    const charCode = str.charCodeAt(i);

    // 检查是否为控制字符（除了制表符、换行符和回车符）
    if (charCode === 0 || (charCode < 32 && charCode !== 9 && charCode !== 10 && charCode !== 13)) {
      return true;
    }
  }
  return false;
};

export const convertStringToBase64 = (fileName: string, content: string) => {
  if (!isBinaryString(content)) {
    return content;
  }

  const buffer = Buffer.from(content, 'binary');
  const mimeType = getContentType(fileName);

  return `data:${mimeType};base64,${buffer.toString('base64')}`;
};

/**
 * 将二进制字符串转换为 Uint8Array，适用于上传到 API
 *
 * @param binaryString 二进制字符串
 * @returns Uint8Array 表示的二进制数据
 */
export const binaryStringToUint8Array = (binaryString: string): Uint8Array => {
  const buffer = Buffer.from(binaryString, 'binary');
  return new Uint8Array(buffer);
};

/**
 * 从路径中获取文件名
 * @param filePath 文件路径
 * @returns 文件名
 */
export function getFileName(filePath: string): string {
  return filePath.split('/').pop() || '';
}

/**
 * 从路径中获取文件扩展名
 * @param filePath 文件路径
 * @returns 文件扩展名
 */
export function getExtension(filePath: string): string {
  return filePath.split('.').pop()?.toLowerCase() || '';
}

export function getContentType(filePath: string): string {
  const extension = filePath.split('.').pop()?.toLowerCase();

  const contentTypeMap: Record<string, string> = {
    html: 'text/html',
    css: 'text/css',
    js: 'application/javascript',
    json: 'application/json',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    svg: 'image/svg+xml',
    webp: 'image/webp',
    ico: 'image/x-icon',
    txt: 'text/plain',
    pdf: 'application/pdf',
  };

  return contentTypeMap[extension || ''] || 'application/octet-stream';
}

/**
 * 根据 MIME 类型获取文件扩展名
 * @param mimeType MIME 类型
 * @returns 文件扩展名
 */
export function getExtensionFromMimeType(mimeType: string): string {
  switch (mimeType) {
    case 'image/jpeg':
      return '.jpg';
    case 'image/png':
      return '.png';
    case 'image/gif':
      return '.gif';
    case 'image/svg+xml':
      return '.svg';
    case 'image/webp':
      return '.webp';
    default:
      return '.bin';
  }
}

/**
 * 将 base64 字符串转换为二进制字符串
 * @param base64 base64 编码的字符串
 * @returns 二进制字符串
 */
export function base64ToBinary(base64: string): string {
  try {
    const raw = atob(base64);

    const rawLength = raw.length;
    const array = new Uint8Array(rawLength);

    for (let i = 0; i < rawLength; i++) {
      array[i] = raw.charCodeAt(i);
    }

    let binaryString = '';
    array.forEach((byte) => {
      binaryString += String.fromCharCode(byte);
    });

    return binaryString;
  } catch (error) {
    console.error('将 base64 转换为二进制字符串时出错:', error);
    return '';
  }
}
