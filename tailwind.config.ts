import type { Config } from "tailwindcss";

const config: Config = {
    darkMode: ["class"],
    content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
  	extend: {
  		fontFamily: {
  			sans: ['var(--font-inter)', 'sans-serif'],
  			heading: ['var(--font-jakarta)', 'sans-serif'],
  		},
  		colors: {
  			ink: '#1C1B17',
  			paper: '#FAF9F6',
  			brass: {
  				DEFAULT: '#B08D57',
  				// Darkened for text-on-tint use in light mode — #B08D57 text on
  				// its own /15 tint fails WCAG AA (2.56:1); this passes (6.1:1).
  				deep: '#6E502A',
  				// Lightened for text-on-tint use in dark mode — the /15 tint sits
  				// on a near-black surface there, so a darkened variant would fail;
  				// this passes 6.04:1 against the same tint over the dark surface.
  				light: '#bd9f72',
  			},
  			rag: {
  				green: '#2E7D32',
  				// Same reasoning as brass.deep — #2E7D32 text on its own /15
  				// tint fails AA (3.99:1); this passes (6.28:1).
  				'green-deep': '#1B5C21',
  				// Dark-mode counterpart to green-deep, verified 6.10:1.
  				'green-light': '#77ab7a',
  				amber: '#ED9B11',
  				red: '#C62828',
  			},
  			// Role-identity accents (Project Manager, Estimator) — kept off the
  			// RAG/brass palette since those are reserved for forecast/risk and
  			// active-state/key-figure use. Deep variants verified at 10:1+ on
  			// their own /15 tint over the light surface; light variants verified
  			// at 6:1+ over the dark surface (same /15 tint, opposite base).
  			steel: {
  				DEFAULT: '#4F6B82',
  				deep: '#24343F',
  				light: '#8ea0af',
  			},
  			heather: {
  				DEFAULT: '#6B5A78',
  				deep: '#352A3D',
  				light: '#a399ab',
  			},
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  			destructive: 'hsl(var(--destructive))',
  			border: 'hsl(var(--border))',
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			chart: {
  				'1': 'hsl(var(--chart-1))',
  				'2': 'hsl(var(--chart-2))',
  				'3': 'hsl(var(--chart-3))',
  				'4': 'hsl(var(--chart-4))',
  				'5': 'hsl(var(--chart-5))'
  			},
  			sidebar: {
  				DEFAULT: 'hsl(var(--sidebar))',
  				foreground: 'hsl(var(--sidebar-foreground))',
  				primary: 'hsl(var(--sidebar-primary))',
  				'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
  				accent: 'hsl(var(--sidebar-accent))',
  				'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
  				border: 'hsl(var(--sidebar-border))',
  				ring: 'hsl(var(--sidebar-ring))'
  			}
  		},
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
  		}
  	}
  },
  plugins: [require("tailwindcss-animate")],
};
export default config;
