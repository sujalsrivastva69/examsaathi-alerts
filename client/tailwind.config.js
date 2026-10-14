/** @type {import('tailwindcss').Config} */
export default {
  theme: {
    extend: {
      colors: {
        ink: "#192923",
        muted: "#68766f",
        canvas: "#f7f8f6",
        forest: "#285b46",
        "forest-dark": "#1e4737",
        mint: "#e8f1eb",
        line: "#e7ebe7",
        saffron: "#bd7629",
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 2px 12px rgba(25, 41, 35, 0.035)",
      },
    },
  },
  plugins: [],
};
