import { css } from "@emotion/css";
import { colour, font, spacing } from "@example/shared/theme/index.ts";

export const layout = css`
  min-height: 100vh;
  padding: ${spacing.xxl} ${spacing.l};
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: ${spacing.xl};
  font-family: ${font.family};
`;

export const header = css`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: ${spacing.xs};
`;

export const title = css`
  margin: 0;
  font-size: ${font.size.xxl};
  font-weight: ${font.weight.bold};
  letter-spacing: ${font.letterSpacing.tight};
  color: ${colour.text.primary};
`;

export const tagline = css`
  margin: 0;
  color: ${colour.text.secondary};
  font-size: ${font.size.m};
`;

export const grid = css`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: ${spacing.m};
  width: 100%;
  max-width: 880px;
`;

export const empty = css`
  color: ${colour.text.muted};
  font-size: ${font.size.s};
  font-style: italic;
`;
