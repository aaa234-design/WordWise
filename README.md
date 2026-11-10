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
