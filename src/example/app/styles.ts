import { css, keyframes } from "@emotion/css";

const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
`;

const float = keyframes`
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-5px); }
`;

const shimmer = keyframes`
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
`;

export const layout = css`
  display: grid;
  grid-template-columns: 1fr 1fr;
  min-height: 100vh;
  font-family:
    "Inter",
    -apple-system,
    BlinkMacSystemFont,
    "Segoe UI",
    Roboto,
    sans-serif;

  @media (max-width: 900px) {
    grid-template-columns: 1fr;
    grid-template-rows: auto 1fr;
  }
`;

export const marketing = css`
  background: #0a0a0f;
  color: white;
  padding: 48px;
  display: flex;
  flex-direction: column;
  position: relative;
  overflow-y: auto;

  @media (max-width: 900px) {
    order: 2;
    padding: 32px 24px;
  }

  &::before {
    content: "";
    position: fixed;
    top: -50%;
    left: -25%;
    width: 100%;
    height: 200%;
    background:
      radial-gradient(
        circle at 20% 80%,
        rgba(120, 119, 198, 0.12) 0%,
        transparent 50%
      ),
      radial-gradient(
        circle at 80% 20%,
        rgba(255, 119, 198, 0.08) 0%,
        transparent 40%
      );
    pointer-events: none;

    @media (max-width: 900px) {
      position: absolute;
    }
  }
`;

export const content = css`
  position: relative;
  z-index: 1;
  max-width: 600px;

  @media (max-width: 900px) {
    max-width: 100%;
  }
`;

export const logo = css`
  height: 108px;
  margin-bottom: 24px;
  animation: ${fadeIn} 0.6s ease-out;
  filter: brightness(0) invert(1);

  @media (max-width: 900px) {
    height: 84px;
    margin-bottom: 16px;
  }
`;

export const headline = css`
  font-size: 44px;
  font-weight: 700;
  line-height: 1.15;
  margin-bottom: 20px;
  animation: ${fadeIn} 0.6s ease-out 0.1s both;
  letter-spacing: -1px;

  @media (max-width: 900px) {
    font-size: 32px;
  }

  span {
    background: linear-gradient(135deg, #7c3aed 0%, #db2777 50%, #f59e0b 100%);
    background-size: 200% auto;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    animation: ${shimmer} 3s linear infinite;
  }
`;

export const tagline = css`
  font-size: 16px;
  line-height: 1.7;
  color: rgba(255, 255, 255, 0.55);
  margin-bottom: 32px;
  animation: ${fadeIn} 0.6s ease-out 0.2s both;

  @media (max-width: 900px) {
    font-size: 14px;
    margin-bottom: 24px;
  }
`;

export const cta = css`
  display: flex;
  gap: 12px;
  animation: ${fadeIn} 0.6s ease-out 0.3s both;

  @media (max-width: 900px) {
    flex-direction: column;
    gap: 8px;
  }
`;

export const button = css`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px 24px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  text-decoration: none;
  transition: all 0.2s ease;
  cursor: pointer;
  border: none;

  &.primary {
    background: white;
    color: #0a0a0f;

    &:hover {
      transform: translateY(-2px);
      box-shadow: 0 10px 40px rgba(255, 255, 255, 0.15);
    }
  }

  &.secondary {
    background: transparent;
    color: white;
    border: 1px solid rgba(255, 255, 255, 0.2);

    &:hover {
      background: rgba(255, 255, 255, 0.05);
      border-color: rgba(255, 255, 255, 0.3);
    }
  }
`;

export const install = css`
  margin-top: 24px;
  margin-bottom: 40px;
  padding: 14px 18px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  font-family: "SF Mono", "Fira Code", monospace;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.7);
  animation: ${fadeIn} 0.6s ease-out 0.4s both;
  display: inline-flex;
  align-items: center;
  gap: 10px;

  @media (max-width: 900px) {
    margin-bottom: 32px;
    font-size: 12px;
  }

  span {
    color: rgba(255, 255, 255, 0.35);
  }
`;

export const features = css`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  animation: ${fadeIn} 0.6s ease-out 0.5s both;

  @media (max-width: 900px) {
    grid-template-columns: repeat(2, 1fr);
    gap: 8px;
  }
`;

export const feature = css`
  padding: 16px;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 10px;
  transition: all 0.2s ease;

  @media (max-width: 900px) {
    padding: 12px;
  }

  &:hover {
    background: rgba(255, 255, 255, 0.04);
    border-color: rgba(255, 255, 255, 0.08);
  }
`;

export const featureIcon = css`
  font-size: 18px;
  margin-bottom: 8px;
  display: block;

  @media (max-width: 900px) {
    font-size: 16px;
    margin-bottom: 6px;
  }
`;

export const featureTitle = css`
  font-size: 12px;
  font-weight: 600;
  margin-bottom: 4px;
  color: white;

  @media (max-width: 900px) {
    font-size: 11px;
  }
`;

export const featureDesc = css`
  font-size: 11px;
  color: rgba(255, 255, 255, 0.4);
  line-height: 1.4;

  @media (max-width: 900px) {
    font-size: 10px;
  }
`;

export const demo = css`
  position: sticky;
  top: 0;
  height: 100vh;
  background: #fafafa;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;

  @media (max-width: 900px) {
    order: 1;
    position: relative;
    height: auto;
    min-height: 300px;
    padding: 48px 24px;
  }
`;

export const demoLabel = css`
  position: absolute;
  top: 24px;
  right: 24px;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 1.5px;
  color: #999;
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 500;

  @media (max-width: 900px) {
    top: 16px;
    right: 16px;
  }
`;

export const liveDot = css`
  width: 8px;
  height: 8px;
  background: #22c55e;
  border-radius: 50%;
  animation: ${float} 2s ease-in-out infinite;
`;

export const demoCard = css`
  animation: ${fadeIn} 0.8s ease-out;
`;
