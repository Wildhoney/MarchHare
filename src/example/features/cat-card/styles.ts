import { css } from "@emotion/css";
import {
  colour,
  font,
  radius,
  shadow,
  spacing,
} from "@example/shared/theme/index.ts";

export const card = css`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: ${spacing.s};
  padding: ${spacing.m};
  border-radius: ${radius.card};
  background: ${colour.surface.card};
  box-shadow: ${shadow.card};
  width: 180px;
`;

export const avatar = css`
  width: 140px;
  height: 140px;
  border-radius: ${radius.pill};
  object-fit: cover;
  filter: grayscale(100%);
  background: ${colour.surface.placeholder};
`;

export const name = css`
  font-family: ${font.family};
  font-size: ${font.size.l};
  font-weight: ${font.weight.semibold};
  color: ${colour.text.primary};
  margin: 0;
`;
