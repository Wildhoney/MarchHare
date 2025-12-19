import { css, keyframes } from "@emotion/css";

const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(-8px); }
  to { opacity: 1; transform: translateY(0); }
`;

export const container = css`
  font-size: 11px;
  color: #666;
  cursor: default;
`;

export const visitor = css`
  display: inline-block;
  animation: ${fadeIn} 0.4s ease-out;
`;

export const waiting = css`
  opacity: 0.6;
`;

export const history = css`
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 13px;
`;
