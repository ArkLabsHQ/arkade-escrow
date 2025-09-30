import type { Config } from "tailwindcss";

export default {
	content: [
		"./app/**/*.{js,ts,jsx,tsx,mdx}",
		"./components/**/*.{js,ts,jsx,tsx,mdx}",
	],
	theme: {
		extend: {
			colors: {
				primary: "#381993",
			},
			fontFamily: {
				sans: [
					"ui-sans-serif",
					"system-ui",
					"Inter",
					"Segoe UI",
					"Roboto",
					"Helvetica",
					"Arial",
					"Apple Color Emoji",
					"Segoe UI Emoji",
					"Segoe UI Symbol",
				],
			},
			borderRadius: {
				"2xl": "1rem",
			},
		},
	},
	plugins: [],
} satisfies Config;
