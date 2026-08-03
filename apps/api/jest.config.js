/** @type {import('jest').Config} */
module.exports = {
  moduleFileExtensions: ["js", "json", "ts"],
  rootDir: "src",
  testRegex: ".*\\.spec\\.ts$",
  transform: {
    "^.+\\.ts$": "ts-jest",
  },
  moduleNameMapper: {
    // puppeteer یک بسته ESM-only است و پارس مستقیمش توسط ts-jest شکست می‌خوره؛
    // تست‌ها هیچ‌وقت Puppeteer واقعی رو صدا نمی‌زنن (PdfRendererService رو mock می‌کنن)
    "^puppeteer$": "<rootDir>/test-mocks/puppeteer.js",
  },
  collectCoverageFrom: ["**/*.ts"],
  coverageDirectory: "../coverage",
  testEnvironment: "node",
};
