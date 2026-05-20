import { defineConfig } from "vite";

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: "index.html",
        contact: "contact/index.html",
        en: "en/index.html",
        enAbout: "en/about/index.html",
        enContact: "en/contact/index.html",
        enSpots: "en/spots/index.html",
        enJournal: "en/journal/index.html",
        enJournalHikawa: "en/journal/hikawa-matcha/index.html",
        journalHikawa: "journal/hikawa-matcha/index.html",
        studio: "studio.html",
      },
    },
  },
});
