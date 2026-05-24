import type { AppConfig } from './types';

export const DEFAULT_CONFIG: AppConfig = {
  canvas: {
    width: 1200,
    height: 675,
    minHeight: 675,
    maxHeight: 675,
    margin: 80,
    footerHeight: 0,
  },
  font: {
    families: {
      serif: 'Georgia, serif',
      sansSerif: 'Arial, sans-serif',
    },
    sizes: {
      quote: {
        base: 48,
        min: 32,
      },
      title: {
        base: 28,
        min: 22,
      },
      author: {
        base: 24,
        min: 18,
      },
      footer: 0,
      decorativeQuote: 0,
    },
    lineHeights: {
      quote: 16,
      title: 10,
      author: 8,
    },
  },
  text: {
    maxLines: {
      quote: 8,
      title: 3,
      author: 2,
    },
    kinsoku: {
      lineStartProhibited: '、。）」』！？、。．，）】｝・ゝゞ々ー～…',
      lineEndProhibited: '（「『（【｛',
    },
  },
  colors: {
    background: '#ffffff',
    accent: '#2d7dd2',
    text: {
      quote: '#1a1a1a',
      title: '#888888',
      author: '#888888',
      footer: '#aaaaaa',
      decorativeQuote: '#cccccc',
    },
    decorative: {
      line: '#eeeeee',
    },
  },
  opacity: {
    decorativeQuote: 0,
    footer: 0,
  },
  spacing: {
    startY: 200,
    sectionGap: {
      afterQuote: 48,
      afterTitle: 24,
    },
    lineGap: {
      quote: 16,
      title: 10,
      author: 8,
    },
    decorativeLine: {
      height: 0,
      thickness: 0,
    },
    accentBar: {
      height: 0,
    },
  },
};

export function getMaxTextWidth(config: AppConfig): number {
  return config.canvas.width - config.canvas.margin * 2;
}
