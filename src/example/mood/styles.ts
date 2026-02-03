import { css } from "@emotion/css";

export const container = css`
  position: fixed;
  inset: auto 20px 20px auto;
  display: flex;
  gap: 12px;
  z-index: 1000;
`;

export const moodCard = css`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 70px;
  aspect-ratio: 1;
  border-radius: 10px;
  cursor: pointer;
  transition:
    transform 0.3s ease,
    filter 0.3s ease,
    opacity 0.3s ease;

  &:hover {
    transform: scale(1.05);
  }
`;

export const happyCard = css`
  ${moodCard}
  background: linear-gradient(135deg, #ffd93d 0%, #ff914d 100%);
  box-shadow: 0 4px 16px rgba(255, 145, 77, 0.3);
  transition:
    transform 0.3s ease,
    filter 0.3s ease,
    opacity 0.3s ease;
`;

export const sadCard = css`
  ${moodCard}
  background: linear-gradient(135deg, #74b9ff 0%, #6c5ce7 100%);
  box-shadow: 0 4px 16px rgba(108, 92, 231, 0.3);
  transition:
    transform 0.3s ease,
    filter 0.3s ease,
    opacity 0.3s ease;
`;

export const inactive = css`
  filter: grayscale(100%);
  opacity: 0.5;
`;

export const emoji = css`
  font-size: 24px;
  line-height: 1;
`;

export const label = css`
  font-size: 10px;
  font-weight: 600;
  color: white;
  text-transform: uppercase;
  letter-spacing: 1px;
`;
