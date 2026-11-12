# WordWise — Multilingual Dictionary

WordWise is a responsive browser-based English dictionary and multilingual learning tool. It shows dictionary definitions, phonetic spelling, examples, translated definitions and examples, and speech playback using voices installed on the user's device.

## Features

- English dictionary lookup with multiple meanings and parts of speech
- Phonetic spelling and dictionary audio when supplied by the dictionary API
- Example sentences for definitions when available
- Translate the searched word into Urdu, Arabic, Hindi, Spanish, French, German, Italian, Turkish, Chinese, Japanese, Portuguese, Russian, Bengali, Punjabi, Korean and Dutch
- Translate multiple dictionary definitions and example sentences into the selected language
- Read translated definitions and examples aloud
- Browser/device speech voices, with female/male preference heuristics, system default, and optional selection of an installed voice
- Recent search history and favourites stored locally in the browser
- Responsive desktop and mobile layout
- Loading, empty and error states

## Run locally

No build tools or package installation are required.

1. Download or clone this repository.
2. Open `index.html` in a modern browser, or run a local server:
   ```bash
   python -m http.server 8000
   ```
3. Open http://localhost:8000.
4. Keep an internet connection active because dictionary and translation data come from public APIs.

## APIs and limitations

- Definitions, phonetics and dictionary audio: [Free Dictionary API](https://dictionaryapi.dev/)
- Word and definition translations: [MyMemory Translation API](https://mymemory.translated.net/)
- Speech: browser Web Speech API (`speechSynthesis`), using voices installed or made available by the operating system/browser

The project does not contain its own translation engine or voice recordings. Translation quality, request limits and availability depend on MyMemory. Not every word has every definition/example, and not every device has male and female voices for every language. Browsers do not provide a consistent standardized voice-gender property; the gender preference therefore uses voice-name hints and falls back to a matching-language voice. Choosing an installed voice explicitly is more reliable.

## Project structure

```
WordWise/
├── index.html
├── style.css
├── app.js
└── README.md
```

## Privacy

Search history, favourites and voice preferences are stored in local browser storage. Dictionary and translation requests are sent to the public API providers.

## License

This project is provided for learning and personal use. Add a license file if you intend to distribute it under a specific open-source license.


## Saved meanings and voice options

- Save individual translated definitions, along with the English original and example, to a personal glossary using **Save meaning**.
- Open **Saved meanings** in the header to review, listen to, or remove saved entries.
- Saved meanings, favourites, search history and voice preferences are stored in this browser's local storage. They are not synced between devices; clearing browser site data can remove them.
- Choose an installed voice from **Available device voice**. Female/male are best-effort preferences because browsers do not expose a reliable universal voice-gender field. Voice availability varies by language and operating system.
- Translation is machine-generated and may be imperfect; use a trusted human translator for high-stakes or formal material.


## WordWise Plus (latest update)

- Paragraph and sentence translation panel with automatic source-language detection where supported by MyMemory.
- Sentence-by-sentence translated output, with listen support.
- Language picker expanded to 100+ language entries, including Urdu, Punjabi, Sindhi and Saraiki codes. Actual availability depends on the translation provider; unsupported pairs return a provider error rather than a fabricated translation.
- PDF text extraction using PDF.js. Image-only scanned pages attempt OCR using Tesseract.js (English and Urdu OCR data); OCR can make mistakes. The browser processes up to 20 pages per upload.
- Pause, resume and stop controls for browser text-to-speech.

### Important limitations
The free MyMemory endpoint may reject some languages or language pairs, particularly regional languages such as Saraiki. The interface lists these requested languages, but does not guarantee provider coverage. Paragraph translations and sentence breakdowns are machine-generated and should be checked by a fluent speaker for important use. PDF/OCR libraries load from public CDNs and require internet access. The current explanation view gives sentence-by-sentence translations; it is not an AI-generated semantic summary.

## Voice input and spoken replies

The WordWise Plus paragraph tool now includes a microphone input option in supported browsers. Choose a recognition language (for example Urdu, English, Punjabi or Hindi), press **Speak instruction**, and say a sentence or paragraph. The recognized text is placed in the text box, translated into the selected target language, and the translated result is read aloud automatically. The normal Listen and Pause/Resume/Stop controls remain available.

Voice recognition uses the browser Web Speech API and is most consistently available in current Chrome and Edge. Browser/device microphone permission is required; recognition language availability varies by browser and operating system. Speech recognition may send audio to the browser vendor's recognition service. This is a voice-enabled translation workflow, not a general-purpose AI assistant: it translates the spoken text rather than answering arbitrary questions with independent knowledge. Spoken output depends on installed system voices.
