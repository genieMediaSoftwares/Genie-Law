/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        gold: {
          DEFAULT: "#F5B900",
          hover: "#D9A300",
          light: "#FFF8E5",
        },
        sidebar: {
          bg: "#111827",
          text: "#9CA3AF",
          active: "#F5B900",
          activeBg: "rgba(245, 185, 0, 0.1)",
        },
        admin: {
          bg: "#F8F9FA",
          card: "#FFFFFF",
          border: "#E5E7EB",
          textPrimary: "#111111",
          textSecondary: "#6B7280",
        },
      },
    },
  },
  plugins: [],
};
