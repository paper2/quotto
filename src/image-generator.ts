import sharp from 'sharp';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { DEFAULT_CONFIG, getMaxTextWidth } from './constants';
import type {
  QuoteData,
  AppConfig,
  FontSizes,
  ElementResult,
  SvgParts,
  ValidationResult,
  NonEmptyString,
  QuottoError,
  ErrorCode,
} from './types';
import {
  createNonEmptyString,
  QuottoError as QuottoErrorClass,
  ErrorCode as EC,
} from './types';

function getCharWidth(char: string): number {
  const code = char.charCodeAt(0);
  // Full-width CJK characters
  if (
    (code >= 0x3000 && code <= 0x303f) || // CJK punctuation
    (code >= 0x3040 && code <= 0x309f) || // Hiragana
    (code >= 0x30a0 && code <= 0x30ff) || // Katakana
    (code >= 0x4e00 && code <= 0x9faf) || // CJK unified ideographs
    (code >= 0xff00 && code <= 0xffef)    // Full-width ASCII
  ) {
    return 2;
  }
  return 1;
}

// Estimate pixel width of a character at given font size (Georgia serif)
function estimateCharPixelWidth(char: string, fontSize: number): number {
  const code = char.charCodeAt(0);

  // Full-width CJK: square characters, width ≈ fontSize
  if (getCharWidth(char) === 2) {
    return fontSize;
  }

  // Space
  if (char === ' ') return fontSize * 0.28;

  // ASCII uppercase (wider letters)
  if (code >= 0x41 && code <= 0x5a) {
    // W, M are widest
    if ('WM'.includes(char)) return fontSize * 0.75;
    // I is narrowest
    if (char === 'I') return fontSize * 0.32;
    return fontSize * 0.62;
  }

  // ASCII lowercase
  if (code >= 0x61 && code <= 0x7a) {
    if ('ijlft'.includes(char)) return fontSize * 0.32;
    if ('mw'.includes(char)) return fontSize * 0.72;
    return fontSize * 0.55;
  }

  // Digits
  if (code >= 0x30 && code <= 0x39) return fontSize * 0.55;

  // Common punctuation
  if ('.,;:!?'.includes(char)) return fontSize * 0.3;
  if ('"\'()[]{}/-'.includes(char)) return fontSize * 0.35;

  // Fallback for other half-width chars
  return fontSize * 0.55;
}

export function wrapText(
  text: string,
  maxWidth: number,
  fontSize: number,
  config: AppConfig = DEFAULT_CONFIG
): string[] {
  const paragraphs = text.split('\n');
  const allLines: string[] = [];

  for (const paragraph of paragraphs) {
    if (paragraph.trim() === '') {
      allLines.push('');
      continue;
    }

    // Tokenize: split into words (for English) and individual CJK chars
    // A "token" is either a CJK character or a sequence of non-CJK chars (word)
    const tokens: string[] = [];
    let buf = '';
    for (const char of paragraph) {
      if (getCharWidth(char) === 2) {
        // CJK: flush buffer, then add char as its own token
        if (buf) { tokens.push(buf); buf = ''; }
        tokens.push(char);
      } else {
        // ASCII/half-width: accumulate into word buffer, break on space
        if (char === ' ') {
          if (buf) { tokens.push(buf); buf = ''; }
          tokens.push(' ');
        } else {
          buf += char;
        }
      }
    }
    if (buf) tokens.push(buf);

    let currentLine = '';
    let currentWidth = 0;

    const flushLine = () => {
      if (currentLine) allLines.push(currentLine);
      currentLine = '';
      currentWidth = 0;
    };

    for (const token of tokens) {
      if (token === ' ') {
        // Add space only if line is not empty
        if (currentLine) {
          const spaceWidth = estimateCharPixelWidth(' ', fontSize);
          currentLine += ' ';
          currentWidth += spaceWidth;
        }
        continue;
      }

      // Calculate token width
      let tokenWidth = 0;
      for (const c of token) {
        tokenWidth += estimateCharPixelWidth(c, fontSize);
      }

      if (currentWidth + tokenWidth > maxWidth && currentLine) {
        // Apply kinsoku for CJK single-char tokens
        if (token.length === 1 && getCharWidth(token) === 2) {
          if (config.text.kinsoku.lineStartProhibited.includes(token)) {
            // Keep this char on current line even if it overflows slightly
            currentLine += token;
            currentWidth += tokenWidth;
            flushLine();
            continue;
          }
          const lastChar = currentLine[currentLine.length - 1];
          if (config.text.kinsoku.lineEndProhibited.includes(lastChar)) {
            // Move last char to next line
            const moved = currentLine[currentLine.length - 1];
            currentLine = currentLine.slice(0, -1);
            flushLine();
            currentLine = moved + token;
            currentWidth = estimateCharPixelWidth(moved, fontSize) + tokenWidth;
            continue;
          }
        }
        flushLine();
        // If single token is wider than maxWidth, force it onto its own line
        currentLine = token;
        currentWidth = tokenWidth;
      } else {
        currentLine += token;
        currentWidth += tokenWidth;
      }
    }

    flushLine();
  }

  return allLines;
}

function truncateTextToMaxLines(lines: string[], maxLines: number): string[] {
  if (lines.length <= maxLines) {
    return lines;
  }

  const truncatedLines = lines.slice(0, maxLines - 1);
  const lastLine = lines[maxLines - 1];

  // Add ellipsis to the last line, ensuring it fits
  const ellipsis = '...';
  if (lastLine.length > 10) {
    truncatedLines.push(lastLine.substring(0, lastLine.length - 3) + ellipsis);
  } else {
    truncatedLines.push(lastLine + ellipsis);
  }

  return truncatedLines;
}

function calculateOptimalFontSizes(
  quoteData: QuoteData,
  config: AppConfig = DEFAULT_CONFIG
): FontSizes {
  // Base font sizes
  let quoteFontSize = config.font.sizes.quote.base;
  let titleFontSize = config.font.sizes.title.base;
  let authorFontSize = config.font.sizes.author.base;

  const maxTextWidth = getMaxTextWidth(config);

  // Calculate estimated line counts with base font sizes
  const quoteLines = wrapText(
    quoteData.quote,
    maxTextWidth,
    quoteFontSize,
    config
  );
  const titleLines = quoteData.title
    ? wrapText(quoteData.title, maxTextWidth, titleFontSize, config)
    : [];
  const authorLines = quoteData.author
    ? wrapText(quoteData.author, maxTextWidth, authorFontSize, config)
    : [];

  // Check if we need to reduce font sizes based on line counts
  if (
    quoteLines.length > config.text.maxLines.quote ||
    titleLines.length > config.text.maxLines.title ||
    authorLines.length > config.text.maxLines.author
  ) {
    // Use minimum font sizes for very long content
    quoteFontSize = config.font.sizes.quote.min;
    titleFontSize = config.font.sizes.title.min;
    authorFontSize = config.font.sizes.author.min;
  }

  return { quoteFontSize, titleFontSize, authorFontSize };
}

function calculateRequiredHeight(
  quoteData: QuoteData,
  fontSizes: FontSizes,
  config: AppConfig = DEFAULT_CONFIG
): number {
  const { quoteFontSize, titleFontSize, authorFontSize } = fontSizes;
  const maxTextWidth = getMaxTextWidth(config);

  let totalHeight = config.spacing.startY; // Starting Y position

  // Quote section - limit to max lines
  const quoteLines = truncateTextToMaxLines(
    wrapText(quoteData.quote, maxTextWidth, quoteFontSize, config),
    config.text.maxLines.quote
  );
  totalHeight +=
    quoteLines.length * (quoteFontSize + config.spacing.lineGap.quote);
  totalHeight += config.spacing.sectionGap.afterQuote; // Section spacing

  // Title section - limit to max lines
  if (quoteData.title) {
    const titleLines = truncateTextToMaxLines(
      wrapText(quoteData.title, maxTextWidth, titleFontSize, config),
      config.text.maxLines.title
    );
    totalHeight +=
      titleLines.length * (titleFontSize + config.spacing.lineGap.title);
    totalHeight += config.spacing.sectionGap.afterTitle; // Section spacing
  }

  // Author section - limit to max lines
  if (quoteData.author) {
    const authorLines = truncateTextToMaxLines(
      wrapText(quoteData.author, maxTextWidth, authorFontSize, config),
      config.text.maxLines.author
    );
    totalHeight +=
      authorLines.length * (authorFontSize + config.spacing.lineGap.author);
  }

  totalHeight += config.canvas.footerHeight; // Footer space

  return totalHeight;
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function createSvgBackground(_config: AppConfig, _canvasHeight: number): string {
  return `<rect width="100%" height="100%" fill="#f8f9fa"/>`;
}

function createDecorativeQuote(_config: AppConfig): string {
  return '';
}

function createDecorativeLines(
  config: AppConfig,
  _maxTextWidth: number,
  quoteStartY: number,
  quoteEndY: number
): string {
  const t = 20;
  const r = 16;
  const w = config.canvas.width;
  const h = config.canvas.height ?? 675;

  // Outer border: blue
  const border = `<rect x="${t / 2}" y="${t / 2}" width="${w - t}" height="${h - t}" fill="none" stroke="${config.colors.accent}" stroke-width="${t}" rx="${r}"/>`;

  // Left accent line: sits between border and text, with gap
  const accentX = config.canvas.margin - 24;
  const accentLine = `<rect x="${accentX}" y="${quoteStartY}" width="10" height="${quoteEndY - quoteStartY}" fill="#c8cdd2" rx="2"/>`;

  return border + accentLine;
}

function createQuoteElements(
  lines: readonly string[],
  config: AppConfig,
  fontSize: number,
  startY: number
): ElementResult {
  let currentY = startY;
  let elements = '';
  const textX = config.canvas.margin;

  for (const line of lines) {
    elements += `
      <text x="${textX}" y="${currentY}"
            fill="${config.colors.text.quote}"
            font-size="${fontSize}"
            font-family="${config.font.families.serif}"
            font-weight="bold"
            text-anchor="start">${escapeXml(line)}</text>`;
    currentY += fontSize + config.spacing.lineGap.quote;
  }

  return { elements, endY: currentY };
}

function createTitleElements(
  lines: readonly string[],
  config: AppConfig,
  fontSize: number,
  startY: number
): ElementResult {
  let currentY = startY;
  let elements = '';
  const textX = config.canvas.margin;

  for (const line of lines) {
    elements += `
      <text x="${textX}" y="${currentY}"
            fill="${config.colors.text.title}"
            font-size="${fontSize}"
            font-family="${config.font.families.sansSerif}"
            text-anchor="start">${escapeXml(line)}</text>`;
    currentY += fontSize + config.spacing.lineGap.title;
  }

  return { elements, endY: currentY };
}

function createAuthorElements(
  lines: readonly string[],
  config: AppConfig,
  fontSize: number,
  startY: number
): ElementResult {
  let currentY = startY;
  let elements = '';
  const textX = config.canvas.width / 2;

  for (const line of lines) {
    elements += `
      <text x="${textX}" y="${currentY}"
            fill="${config.colors.text.author}"
            font-size="${fontSize}"
            font-family="${config.font.families.sansSerif}"
            text-anchor="middle">${escapeXml(line)}</text>`;
    currentY += fontSize + config.spacing.lineGap.author;
  }

  return { elements, endY: currentY };
}

function createFooter(_config: AppConfig, _canvasHeight: number): string {
  return '';
}

function assembleSvg(
  config: AppConfig,
  canvasHeight: number,
  parts: SvgParts
): string {
  return `
    <svg width="${config.canvas.width}" height="${canvasHeight}" xmlns="http://www.w3.org/2000/svg">
      ${parts.background}
      ${parts.decorativeQuote}
      ${parts.decorativeLines}
      ${parts.quote}
      ${parts.title}
      ${parts.author}
      ${parts.footer}
    </svg>
  `;
}

function validateQuoteData(quoteData: QuoteData): ValidationResult<QuoteData> {
  const quoteResult = createNonEmptyString(quoteData.quote);
  if (!quoteResult.success) {
    return {
      success: false,
      error: `Quote text is required: ${quoteResult.error}`,
    };
  }

  return { success: true, data: quoteData };
}

function validateOutputPath(outputPath: string): ValidationResult<string> {
  if (!outputPath || outputPath.trim() === '') {
    return { success: false, error: 'Output path cannot be empty' };
  }

  const trimmed = outputPath.trim();
  if (!trimmed.endsWith('.png')) {
    return { success: false, error: 'Output path must have .png extension' };
  }

  return { success: true, data: trimmed };
}

export async function generateQuoteImage(
  quoteData: QuoteData,
  outputPath: string,
  config: AppConfig = DEFAULT_CONFIG
): Promise<void> {
  // Validate inputs
  const quoteValidation = validateQuoteData(quoteData);
  if (!quoteValidation.success) {
    throw new QuottoErrorClass(quoteValidation.error, EC.EMPTY_QUOTE, {
      quoteData,
    });
  }

  const pathValidation = validateOutputPath(outputPath);
  if (!pathValidation.success) {
    throw new QuottoErrorClass(pathValidation.error, EC.INVALID_OUTPUT_PATH, {
      outputPath,
    });
  }

  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Calculate optimal font sizes based on content length
  const fontSizes = calculateOptimalFontSizes(quoteData, config);
  const { quoteFontSize, titleFontSize, authorFontSize } = fontSizes;

  // Calculate required canvas height
  const requiredHeight = calculateRequiredHeight(quoteData, fontSizes, config);
  const canvasHeight = config.canvas.height ?? Math.max(
    config.canvas.minHeight,
    Math.min(config.canvas.maxHeight, requiredHeight)
  );

  const maxTextWidth = getMaxTextWidth(config);

  // Prepare text lines
  const quoteLines = truncateTextToMaxLines(
    wrapText(quoteData.quote, maxTextWidth, quoteFontSize, config),
    config.text.maxLines.quote
  );

  const titleLines = quoteData.title
    ? truncateTextToMaxLines(
      wrapText(quoteData.title, maxTextWidth, titleFontSize, config),
      config.text.maxLines.title
    )
    : [];

  const authorLines = quoteData.author
    ? truncateTextToMaxLines(
      wrapText(quoteData.author, maxTextWidth, authorFontSize, config),
      config.text.maxLines.author
    )
    : [];

  // Generate SVG elements using template functions
  // Calculate exact text block height for vertical centering
  const quoteBlockHeight = quoteLines.length * (quoteFontSize + config.spacing.lineGap.quote) - config.spacing.lineGap.quote;
  const titleBlockHeight = titleLines.length > 0
    ? config.spacing.sectionGap.afterQuote + titleLines.length * (titleFontSize + config.spacing.lineGap.title) - config.spacing.lineGap.title
    : 0;
  const authorBlockHeight = authorLines.length > 0
    ? config.spacing.sectionGap.afterTitle + authorLines.length * (authorFontSize + config.spacing.lineGap.author) - config.spacing.lineGap.author
    : 0;
  const totalTextHeight = quoteBlockHeight + titleBlockHeight + authorBlockHeight;

  const borderThickness = 20;
  const startY = config.canvas.height
    ? Math.round((canvasHeight - totalTextHeight) / 2) + quoteFontSize
    : config.spacing.startY;
  let currentY = startY;

  const quoteResult = createQuoteElements(
    quoteLines,
    config,
    quoteFontSize,
    currentY
  );
  currentY = quoteResult.endY + config.spacing.sectionGap.afterQuote;

  const titleResult =
    titleLines.length > 0
      ? createTitleElements(titleLines, config, titleFontSize, currentY)
      : { elements: '', endY: currentY };
  currentY =
    titleResult.endY +
    (titleLines.length > 0 ? config.spacing.sectionGap.afterTitle : 0);

  const authorResult =
    authorLines.length > 0
      ? createAuthorElements(authorLines, config, authorFontSize, currentY)
      : { elements: '', endY: currentY };

  // Assemble SVG
  const svg = assembleSvg(config, canvasHeight, {
    background: createSvgBackground(config, canvasHeight),
    decorativeQuote: createDecorativeQuote(config),
    decorativeLines: createDecorativeLines(
      config,
      maxTextWidth,
      startY - quoteFontSize - 1,
      quoteResult.endY - config.spacing.lineGap.quote - quoteFontSize + 1
    ),
    quote: quoteResult.elements,
    title: titleResult.elements,
    author: authorResult.elements,
    footer: '',
  });

  const buffer = Buffer.from(svg);

  try {
    await sharp(buffer).png().toFile(outputPath);
  } catch (error) {
    throw new QuottoErrorClass(
      `Failed to write image file: ${error instanceof Error ? error.message : 'Unknown error'}`,
      EC.FILE_WRITE_FAILED,
      { outputPath, error }
    );
  }
}
