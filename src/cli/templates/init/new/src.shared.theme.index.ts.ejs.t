---
to: src/shared/theme/index.ts
---
export const colour = <const>{
  text: {
    primary: "#1f1f1f",
    secondary: "#6b6b6b",
    muted: "#9b9b9b",
  },
  surface: {
    card: "#ffffff",
    placeholder: "#f0f0f0",
  },
};

export const spacing = <const>{
  xs: "8px",
  s: "12px",
  m: "20px",
  l: "24px",
  xl: "32px",
  xxl: "48px",
};

export const radius = <const>{
  card: "16px",
  pill: "50%",
};

export const shadow = <const>{
  card: "0 1px 2px rgba(0, 0, 0, 0.04), 0 4px 16px rgba(0, 0, 0, 0.06)",
};

export const font = <const>{
  family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  size: {
    s: "14px",
    m: "15px",
    l: "16px",
    xl: "22px",
    xxl: "36px",
  },
  weight: {
    regular: 400,
    semibold: 600,
    bold: 700,
  },
  letterSpacing: {
    tight: "-0.02em",
  },
};
