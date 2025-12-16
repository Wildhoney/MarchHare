import type { Config } from "jest";

const config: Config = {
  testEnvironment: "jsdom",
  testPathIgnorePatterns: ["/node_modules/", "/tests/"],
};

export default config;
