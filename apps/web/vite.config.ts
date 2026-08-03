import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    // PORT از محیط (مثلاً preview harness) — پیش‌فرض 5173
    port: Number(process.env.PORT) || 5173,
  },
});
