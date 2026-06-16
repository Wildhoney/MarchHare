---
to: package.json
---
{
  "name": "<%= name %>",
  "version": "0.1.0",
  "description": "<%= description %>",
  "type": "module",
  "private": true,
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test",
    "typecheck": "tsc --noEmit",
    "lint": "eslint src/",
    "fmt": "prettier --write .",
    "checks": "npm run fmt && npm run lint && npm run typecheck && npm run test"
  },
  "dependencies": {
    "@emotion/css": "^11.13.5",
    "@mobily/ts-belt": "^3.0.0",
    "antd": "^6.3.0",
    "immer": "^10.0.0",
    "ky": "^2.0.2",
    "march-hare": "^0.13.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@eslint/js": "^9.39.3",
    "@playwright/test": "^1.58.2",
    "@testing-library/dom": "^10.4.1",
    "@testing-library/jest-dom": "^6.9.1",
    "@testing-library/react": "^16.3.2",
    "@types/react": "^19.2.14",
    "@types/react-dom": "^19.2.3",
    "@vitejs/plugin-react": "^5.1.4",
    "eslint": "^9.39.3",
    "eslint-import-resolver-typescript": "^4.4.5",
    "eslint-plugin-boundaries": "^6.0.2",
    "eslint-plugin-import": "^2.32.0",
    "eslint-plugin-react": "^7.37.5",
    "globals": "^17.3.0",
    "happy-dom": "^20.6.1",
    "prettier": "^3.8.1",
    "typescript": "^6.0.3",
    "typescript-eslint": "^8.55.0",
    "vite": "^7.3.1",
    "vitest": "^4.0.18"
  }
}
