/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    container: {
      center: true,
      padding: '1rem',
    },
    extend: {
      colors: {
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        primary: {
          DEFAULT: 'var(--primary)',
          foreground: 'var(--primary-foreground)',
        },
        secondary: {
          DEFAULT: 'var(--secondary)',
          foreground: 'var(--secondary-foreground)',
        },
        accent: {
          DEFAULT: 'var(--accent)',
          foreground: 'var(--accent-foreground)',
        },
        muted: {
          DEFAULT: 'var(--muted)',
          foreground: 'var(--muted-foreground)',
        },
        card: {
          DEFAULT: 'var(--card)',
          foreground: 'var(--card-foreground)',
        },
        border: 'var(--border)',
        input: 'var(--input)',
        ring: 'var(--ring)',
      },
      borderRadius: {
        DEFAULT: 'var(--radius)',
        sm: 'calc(var(--radius) - 2px)',
        lg: 'calc(var(--radius) + 4px)',
        xl: 'calc(var(--radius) + 8px)',
        '2xl': 'calc(var(--radius) + 12px)',
        '3xl': 'calc(var(--radius) + 20px)',
      },
      fontFamily: {
        sans: ['var(--font-plus-jakarta-sans)', 'sans-serif'],
        display: ['var(--font-plus-jakarta-sans)', 'sans-serif'],
      },
      animation: {
        'float': 'floatBadge 3s ease-in-out infinite',
        'float-delayed': 'floatBadge 3s ease-in-out 1.5s infinite',
        'shimmer': 'shimmer 1.5s infinite',
      },
      keyframes: {
        floatBadge: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-8px)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      boxShadow: {
        'card': '0 4px 16px -4px rgba(30, 58, 95, 0.08), 0 1px 4px rgba(0, 0, 0, 0.04)',
        'card-lg': '0 12px 40px -8px rgba(30, 58, 95, 0.14), 0 4px 12px rgba(0, 0, 0, 0.06)',
        'primary': '0 8px 24px -4px rgba(30, 58, 95, 0.35)',
        'accent': '0 8px 24px -4px rgba(249, 115, 22, 0.4)',
      },
    },
  },
  plugins: [require('@tailwindcss/typography')],
};