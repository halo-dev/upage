import prettier, { type BuiltInParserName, type Options } from 'prettier';
import * as html from 'prettier/plugins/html';
import * as css from 'prettier/plugins/postcss';
import * as javascript from 'prettier/plugins/typescript';
import { path } from '../../utils/path';

const ignoreFiles = ['tailwindcss.js', 'iconify-icon.min.js'];

export function formatCode(code: string, options?: Options) {
  return prettier.format(code, {
    ...options,
    parser: 'html',
    plugins: [html, css, javascript],
  });
}

export function formatFile(filePath: string, code: string, options?: Options) {
  if (ignoreFiles.includes(filePath)) {
    return code;
  }
  const parser = getParser(filePath);
  if (!parser) {
    return code;
  }
  return prettier.format(code, {
    ...options,
    parser,
    plugins: [html, css, javascript],
  });
}

export function getParser(filePath: string): BuiltInParserName | undefined {
  const ext = path.extname(filePath);
  switch (ext) {
    case '.html':
      return 'html';
    case '.css':
      return 'css';
    case '.js':
      return 'typescript';
    case '.ts':
      return 'typescript';
    case '.md':
      return 'markdown';
    case '.vue':
      return 'vue';
    case '.json':
      return 'json';
    default:
      return undefined;
  }
}

export function normalizeContent(content?: string) {
  return content?.replace(/\r\n/g, '\n').trim();
}
