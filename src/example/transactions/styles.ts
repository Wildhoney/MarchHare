import { css } from "@emotion/css";

export const layout = css`
  max-width: 640px;
  margin: 0 auto;
  padding: 32px 20px 80px;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
`;

export const header = css`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24px;

  h1 {
    margin: 0;
    font-size: 24px;
    font-weight: 700;
  }
`;

export const refresh = css`
  padding: 8px 16px;
  border: 1px solid #d8d8de;
  background: white;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  color: #444;
  cursor: pointer;
  transition: all 0.15s ease;

  &:hover:not(:disabled) {
    border-color: #6c5ce7;
    color: #6c5ce7;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

export const list = css`
  list-style: none;
  margin: 0;
  padding: 0;
  border-top: 1px solid #eee;
`;

export const item = css`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 4px;
  border-bottom: 1px solid #f0f0f0;
`;

export const itemMain = css`
  display: flex;
  flex-direction: column;
  gap: 2px;
`;

export const merchant = css`
  font-weight: 600;
  font-size: 14px;
  color: #222;
`;

export const description = css`
  font-size: 12px;
  color: #888;
`;

export const amount = css`
  font-variant-numeric: tabular-nums;
  font-weight: 600;
  font-size: 14px;
  color: #c0392b;
`;

export const sentinel = css`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px 0;
  color: #888;
  font-size: 13px;
`;

export const spinner = css`
  width: 16px;
  height: 16px;
  border: 2px solid #ddd;
  border-top-color: #6c5ce7;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin-right: 8px;

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
`;

export const end = css`
  text-align: center;
  padding: 32px 0;
  color: #aaa;
  font-size: 13px;
  font-style: italic;
`;

export const empty = css`
  padding: 80px 0;
  text-align: center;
  color: #aaa;
`;
