import { defineConfig } from "vite";

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: "index.html",
        en: "en/index.html",
        studio: "studio.html",
      },
    },
  },
});
