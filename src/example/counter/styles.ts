import { css, keyframes } from "@emotion/css";

const spin = keyframes`
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
`;

export const container = css`
  width: 100vw;
  height: 100vh;
  display: flex;
  place-content: center;
  place-items: center;
  font-family:
    -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu,
    Cantarell, sans-serif;
  background: #f5f5f5;
`;

export const card = css`
  background: transparent;
  padding: 32px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
`;

export const header = css`
  display: flex;
  align-items: center;
  gap: 8px;
`;

export const title = css`
  margin: 0;
  font-size: 18px;
  font-weight: 500;
  color: #333;
`;

export const loading = css`
  display: flex;
  align-items: center;
`;

export const spinner = css`
  width: 16px;
  height: 16px;
  border: 2px solid #e0e0e0;
  border-top-color: #333;
  border-radius: 50%;
  animation: ${spin} 0.8s linear infinite;
`;

export const display = css`
  padding: 16px 32px;
  background: #fafafa;
  border-radius: 12px;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  min-width: 100px;
`;

export const group = css`
  display: flex;
  align-items: center;
  gap: 12px;
`;

export const button = css`
  position: relative;
  width: 48px;
  height: 48px;
  border: none;
  border-radius: 50%;
  background: white;
  color: #333;
  font-size: 32px;
  font-weight: 300;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  user-select: none;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;

  &:hover {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  }

  &:active {
    transform: scale(0.95);
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.2);
  }
`;
