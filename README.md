# WordWise — Multilingual Dictionary

WordWise is a responsive, browser-based English dictionary and multilingual word translator. Search a word to explore its definitions, phonetic spelling, examples and translation.

## Features

- English word lookup with multiple meanings and parts of speech
- Phonetic spelling and audio pronunciation when available
- Example sentences
- Translation into Urdu, Spanish, French, Arabic, Hindi, German, Italian, Turkish, Chinese, Japanese, Portuguese and Russian
- Recent search history saved in the browser
- Favourite words saved in the browser
- Responsive layout for desktop, tablet and mobile
- Helpful loading, empty and error states

## Run locally

No build tools or package installation are required.

1. Download or clone this repository.
2. Open `index.html` in a modern browser.
3. Make sure you have an internet connection so the dictionary and translation APIs can respond.

Alternatively, run a local server from the project folder:

```bash
python -m http.server 8000
```

Then open http://localhost:8000.

## APIs

- Definitions and phonetics: [Free Dictionary API](https://dictionaryapi.dev/)
- Translations: [MyMemory Translation API](https://mymemory.translated.net/)

The app uses public endpoints directly from the browser. Their availability, usage limits and terms are controlled by the API providers. Translation quality may vary by language and context.

## Project structure

```
WordWise/
├── index.html
├── style.css
├── app.js
└── README.md
```

## Notes

- Search is designed for English source words.
- Search history and favourites use browser local storage and stay on the current device/browser.
- This is a front-end project; it does not require a database or backend server.

## License

This project is provided for learning and personal use. Add a license file if you intend to distribute it under a specific open-source license.
