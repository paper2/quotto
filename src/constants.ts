import type { AppConfig } from './types';

export const DEFAULT_CONFIG: AppConfig = {
  canvas: {
    width: 600,
    height: 335,
    minHeight: 335,
    maxHeight: 335,
    margin: 45,
    footerHeight: 0,
  },
  font: {
    families: {
      serif: 'Georgia, serif',
      sansSerif: 'Arial, sans-serif',
    },
    sizes: {
      quote: {
        base: 20,
        min: 14,
      },
      title: {
        base: 14,
        min: 11,
      },
      author: {
        base: 12,
        min: 9,
      },
      footer: 0,
      decorativeQuote: 0,
    },
    lineHeights: {
      quote: 8,
      title: 5,
      author: 4,
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
    startY: 100,
    sectionGap: {
      afterQuote: 24,
      afterTitle: 12,
    },
    lineGap: {
      quote: 8,
      title: 5,
      author: 4,
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
