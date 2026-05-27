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
        enJournalNihonchaOrigin: "en/journal/nihoncha-origin/index.html",
        enJournalSenkeDifference: "en/journal/senke-difference/index.html",
        enJournalHikawa: "en/journal/hikawa-matcha/index.html",
        enJournalDaikanyamaSabo: "en/journal/daikanyama-sabo/index.html",
        journalNihonchaOrigin: "journal/nihoncha-origin/index.html",
        journalSenkeDifference: "journal/senke-difference/index.html",
        journalHikawa: "journal/hikawa-matcha/index.html",
        journalDaikanyamaSabo: "journal/daikanyama-sabo/index.html",
        studio: "studio.html",
      },
    },
  },
});
