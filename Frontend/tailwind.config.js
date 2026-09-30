const { colors, radius, sizing } = require('./src/theme/tokens.js');

module.exports = {
  content: [
    './App.tsx',
    './src/**/*.{js,jsx,ts,tsx}',
    './web/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],

  darkMode: 'class',

  theme: {
    extend: {
      colors: {
        background: colors.background,
        surface: {
          DEFAULT: colors.surface,
          alt: colors.surfaceAlt,
          secondary: colors.surfaceSecondary,
        },
        card: colors.card,
        input: colors.inputBackground,

        gold: {
          DEFAULT: colors.gold,
          bright: colors.goldBright,
          pressed: colors.goldPressed,
          muted: colors.goldMuted,
          wash: colors.goldWash,
        },
        'on-gold': colors.onGold,
        accent: colors.accent,
        'on-accent': colors.onAccent,
        primary: colors.textPrimary,

        secondary: colors.textSecondary,
        muted: colors.textMuted,

        border: colors.border,
        focus: colors.borderFocused,

        success: {
          DEFAULT: colors.success,
          surface: colors.successSurface,
        },
        warning: {
          DEFAULT: colors.warning,
          surface: colors.warningSurface,
        },
        error: {
          DEFAULT: colors.error,
          surface: colors.errorSurface,
        },
        info: {
          DEFAULT: colors.info,
          surface: colors.infoSurface,
        },

        overlay: colors.overlay,
        disabled: {
          DEFAULT: colors.disabled,
          text: colors.disabledText,
        },
        skeleton: {
          DEFAULT: colors.skeleton,
          highlight: colors.skeletonHighlight,
        },
      },

      borderColor: {
        DEFAULT: colors.border,
      },

      borderRadius: {
        ...radius,
        button: '10px',
        'button-sm': '8px',
        card: '12px',
        badge: '14px',
        sheet: '20px',
        pill: '9999px',
      },

      fontSize: {
        hero: ['28px', '34px'],
        'screen-title': ['24px', '29px'],
        'section-title': ['18px', '23px'],
        'card-title': ['16px', '21px'],
        body: ['14px', '20px'],
        secondary: ['13px', '18px'],
        caption: ['12px', '16px'],
        'small-label': ['11px', '14px'],
        button: ['14px', '18px'],
        'status-badge': ['12px', '16px'],
        stat: ['20px', '24px'],

        display: ['28px', '34px'],
        'head-xl': ['24px', '29px'],
        'head-lg': ['24px', '29px'],
        'head-md': ['18px', '23px'],
        'head-sm': ['18px', '23px'],
        'body-lg': ['16px', '21px'],
        'body-md': ['14px', '20px'],
        'body-sm': ['13px', '18px'],
      },

      height: {
        control: sizing.control,
        touch: sizing.touch,
        button: '44px',
        'button-sm': '36px',
        input: '48px',
        badge: '28px',
        tab: '44px',
        header: '56px',
        'bottom-nav': '64px',
      },
      width: {
        control: sizing.control,
        touch: sizing.touch,
        'icon-button': '40px',
      },
      minHeight: {
        control: sizing.control,
        touch: sizing.touch,
        button: '44px',
        'button-sm': '36px',
        input: '48px',
        'profile-row': '56px',
      },
      minWidth: { touch: sizing.touch },
      spacing: { gutter: sizing.screenGutter, card: '16px', 'card-gap': '12px' },
    },
  },

  plugins: [],
};
