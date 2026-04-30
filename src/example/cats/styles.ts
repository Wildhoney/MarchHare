import { css } from "@emotion/css";

export const layout = css`
  max-width: 640px;
  margin: 0 auto;
  padding: 40px 20px;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
`;

export const header = css`
  text-align: center;
  margin-bottom: 24px;

  h1 {
    margin: 0 0 8px;
    font-size: 32px;
    font-weight: 700;
    background: linear-gradient(135deg, #ff914d 0%, #6c5ce7 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }
`;

export const tagline = css`
  margin: 0;
  color: #666;
  font-size: 14px;
`;

export const figure = css`
  position: relative;
  margin: 0 0 20px;
  aspect-ratio: 4 / 3;
  border-radius: 16px;
  overflow: hidden;
  background: #f4f4f6;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1);
`;

export const image = css`
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: opacity 0.2s ease;
`;

export const skeleton = css`
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, #eee 0%, #f6f6f6 50%, #eee 100%);
  background-size: 200% 100%;
  animation: shimmer 1.4s ease-in-out infinite;

  @keyframes shimmer {
    0% {
      background-position: 200% 0;
    }
    100% {
      background-position: -200% 0;
    }
  }
`;

export const error = css`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  color: #c0392b;
  font-size: 14px;
  font-weight: 500;
`;

export const spinner = css`
  position: absolute;
  top: 12px;
  right: 12px;
  width: 18px;
  height: 18px;
  border: 2px solid rgba(255, 255, 255, 0.4);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
`;

export const controls = css`
  display: flex;
  gap: 8px;
  margin-bottom: 24px;
`;

export const button = css`
  flex: 1;
  padding: 12px 16px;
  border: 1px solid #d8d8de;
  background: white;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 600;
  color: #333;
  cursor: pointer;
  transition: all 0.15s ease;

  &:hover:not(:disabled) {
    border-color: #6c5ce7;
    color: #6c5ce7;
    transform: translateY(-1px);
  }

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
`;

export const primary = css`
  background: linear-gradient(135deg, #ff914d 0%, #6c5ce7 100%);
  color: white;
  border-color: transparent;

  &:hover:not(:disabled) {
    color: white;
    filter: brightness(1.1);
  }
`;

export const history = css`
  padding: 16px 20px;
  background: #fafafb;
  border-radius: 10px;

  h2 {
    margin: 0 0 8px;
    font-size: 12px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: #888;
  }

  ol {
    margin: 0;
    padding-left: 20px;
    font-size: 12px;
    color: #555;

    li {
      padding: 2px 0;
    }

    code {
      font-family:
        ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      background: white;
      padding: 1px 6px;
      border-radius: 4px;
      border: 1px solid #eee;
    }
  }
`;
