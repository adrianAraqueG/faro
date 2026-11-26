import path from "path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const api = `http://127.0.0.1:${process.env.FARO_PORT || 4317}`;

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  // En desarrollo la interfaz (Vite) delega /api en el servidor local de FARO.
  server: { proxy: { "/api": api } },
});
