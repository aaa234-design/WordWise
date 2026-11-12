const $ = (selector) => document.querySelector(selector);
const form = $('#searchForm');
const input = $('#wordInput');
const resultArea = $('#resultArea');
const resultKicker = $('#resultKicker');
const translateButton = $('#translateButton');
const languageSelect = $('#languageSelect');
const translationResult = $('#translationResult');
const localizedDetails = $('#localizedDetails');
const voiceGenderSelect = $('#voiceGenderSelect');
const voiceSelect = $('#voiceSelect');
const voiceStatus = $('#voiceStatus');

let currentWord = '';
let currentAudio = '';
let currentEntry = null;
let searchSequence = 0;
let history = readStorage('wordwise-history', []);
let favourites = readStorage('wordwise-favourites', []);
let savedMeanings = readStorage('wordwise-saved-meanings', []);
let availableVoices = [];

function readStorage(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || 'null');
    return Array.isArray(value) ? value : fallback;
  } catch (_) {
    return fallback;
  }
}

function showToast(message) {
  const toast = $('#toast');
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove('show'), 2800);
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[char]));
}

function languageBase(code) {
  return String(code || 'en').toLowerCase().split('-')[0];
}

function refreshVoiceList() {
  if (!('speechSynthesis' in window)) {
    voiceSelect.innerHTML = '<option value="">Speech is not supported</option>';
    voiceStatus.textContent = 'This browser does not support speech synthesis. Try an updated Chrome, Edge, or Safari browser.';
    return;
  }
  availableVoices = window.speechSynthesis.getVoices();
  const previous = localStorage.getItem('wordwise-voice-id') || '';
  voiceSelect.innerHTML = '<option value="">Automatic voice for each language</option>';
  availableVoices.forEach((voice, index) => {
    const option = document.createElement('option');
    option.value = String(index);
    option.textContent = voice.name + ' (' + voice.lang + ')' + (voice.default ? ' — system default' : '');
    option.dataset.identity = voice.name + '|' + voice.lang;
    if (option.dataset.identity === previous) option.selected = true;
    voiceSelect.appendChild(option);
  });
  voiceStatus.textContent = availableVoices.length
    ? availableVoices.length + ' device voice(s) found. Voice gender labels are preferences; the device supplies the actual voices.'
    : 'No device voices have loaded yet. Wait a moment or check your operating system speech settings.';
}

if ('speechSynthesis' in window) {
  refreshVoiceList();
  window.speechSynthesis.addEventListener?.('voiceschanged', refreshVoiceList);
  // Some browsers fire voiceschanged only after getVoices() is called again.
  setTimeout(refreshVoiceList, 500);
}
if (!localStorage.getItem('wordwise-voice-style')) localStorage.setItem('wordwise-voice-style', 'male');
voiceGenderSelect.value = localStorage.getItem('wordwise-voice-style') || 'male';
voiceGenderSelect.addEventListener('change', () => {
  localStorage.setItem('wordwise-voice-style', voiceGenderSelect.value);
  localStorage.removeItem('wordwise-voice-id');
  voiceSelect.value = '';
  showToast('Voice preference saved');
});
$('#saveVoiceSettings').addEventListener('click', () => {
  localStorage.setItem('wordwise-voice-style', voiceGenderSelect.value);
  const selected = voiceSelect.value !== '' ? availableVoices[Number(voiceSelect.value)] : null;
  if (selected) localStorage.setItem('wordwise-voice-id', selected.name + '|' + selected.lang);
  else localStorage.removeItem('wordwise-voice-id');
  showToast('Voice settings saved on this device');
});
voiceSelect.addEventListener('change', () => {
  const voice = voiceSelect.value !== '' ? availableVoices[Number(voiceSelect.value)] : null;
  if (voice) localStorage.setItem('wordwise-voice-id', voice.name + '|' + voice.lang);
  else localStorage.removeItem('wordwise-voice-id');
  showToast('Device voice preference saved');
});

function speakText(text, language = 'en') {
  if (!('speechSynthesis' in window) || !text) {
    showToast('Voice playback is not supported in this browser.');
    return;
  }
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(String(text));
  utterance.lang = language || 'en';
  const voices = window.speechSynthesis.getVoices();
  const base = languageBase(language);
  const matching = voices.filter(voice => languageBase(voice.lang) === base);
  const selectedIdentity = localStorage.getItem('wordwise-voice-id');
  const explicitVoice = selectedIdentity
    ? voices.find(voice => voice.name + '|' + voice.lang === selectedIdentity)
    : null;
  const style = voiceGenderSelect.value;
  const femaleNames = /female|woman|zira|samantha|victoria|karen|susan|aria|jenny|sara|eva|monica/i;
  const maleNames = /male|man|david|mark|daniel|james|george|guy|ryan|alex|thomas/i;
  const preferred = style === 'default' ? null : matching.find(voice =>
    (style === 'female' ? femaleNames : maleNames).test(voice.name)
  );
  let chosen = null;
  if (explicitVoice && languageBase(explicitVoice.lang) === base) chosen = explicitVoice;
  else chosen = preferred || matching.find(voice => voice.default) || matching[0] || null;

  if (chosen) utterance.voice = chosen;
  else if (explicitVoice && languageBase(explicitVoice.lang) !== base) {
    showToast('Your selected voice is for another language. Using a matching voice if available.');
  } else if (!matching.length) {
    showToast('No installed voice found for ' + language + '. Your browser may use its default voice.');
  }
  utterance.rate = 0.9;
  utterance.onerror = () => showToast('Voice playback failed. Check your device speech settings.');
  window.speechSynthesis.speak(utterance);
}

function saveHistory(word) {
  history = [word, ...history.filter(item => item.toLowerCase() !== word.toLowerCase())].slice(0, 25);
  localStorage.setItem('wordwise-history', JSON.stringify(history));
}

function renderHistory() {
  const list = $('#historyList');
  if (!history.length) {
    list.innerHTML = '<p class="no-history">No searches yet. Your searched words will show up here.</p>';
    return;
  }
  list.innerHTML = history.map(word =>
    '<div class="history-item"><button type="button" data-word="' + escapeHtml(word) + '">' +
    escapeHtml(word) + '</button><small>Search again ↗</small></div>'
  ).join('');
  list.querySelectorAll('[data-word]').forEach(button => button.addEventListener('click', () => {
    $('#historyModal').classList.remove('open');
    searchWord(button.dataset.word);
  }));
}

function getDefinitionItems(entry) {
  const items = [];
  (entry.meanings || []).slice(0, 4).forEach(meaning => {
    (meaning.definitions || []).slice(0, 2).forEach(definition => {
      if (definition.definition) items.push({
        partOfSpeech: meaning.partOfSpeech || 'Meaning',
        definition: definition.definition,
        example: definition.example || ''
      });
    });
  });
  return items.slice(0, 8);
}

function renderWord(entry) {
  currentEntry = entry;
  const meanings = entry.meanings || [];
  const phonetic = entry.phonetic || (entry.phonetics || []).find(item => item.text)?.text || 'Pronunciation not available';
  currentAudio = (entry.phonetics || []).find(item => item.audio)?.audio || '';
  const saved = favourites.some(word => word.toLowerCase() === currentWord.toLowerCase());
  const meaningHtml = meanings.slice(0, 4).map((meaning, index) => {
    const defs = (meaning.definitions || []).slice(0, 2);
    return '<div class="part-of-speech">' + escapeHtml(meaning.partOfSpeech || 'Meaning') + '</div>' +
      defs.map((def, i) =>
        '<p class="definition"><span class="meaning-number">' + (index + 1) + '.' + (i + 1) +
        '</span>' + escapeHtml(def.definition || '') + '</p>' +
        (def.example ? '<div class="example-box">“' + escapeHtml(def.example) + '”</div>' : '')
      ).join('');
  }).join('');

  resultArea.innerHTML =
    '<div class="word-top"><div><h2 class="word-title">' + escapeHtml(entry.word || currentWord) +
    '</h2><div class="phonetic">' + escapeHtml(phonetic) + '</div></div><div class="word-actions">' +
    (currentAudio ? '<button class="icon-button" id="audioButton" aria-label="Play dictionary audio" title="Play dictionary audio">♫</button>' : '') +
    '<button class="icon-button" id="speakDefinitionButton" aria-label="Read English definitions aloud" title="Read English definitions aloud">🔊</button>' +
    '<button class="icon-button ' + (saved ? 'saved' : '') + '" id="favouriteButton" aria-label="Save favourite" title="Save favourite">' +
    (saved ? '♥' : '♡') + '</button></div></div>' + meaningHtml;

  const audioButton = $('#audioButton');
  if (audioButton) audioButton.addEventListener('click', () =>
    new Audio(currentAudio).play().catch(() => showToast('Dictionary audio could not be played.'))
  );
  $('#speakDefinitionButton').addEventListener('click', () => {
    const spoken = getDefinitionItems(entry).map(item =>
      item.partOfSpeech + '. ' + item.definition + (item.example ? '. Example: ' + item.example : '')
    ).join('. ');
    speakText((entry.word || currentWord) + '. ' + spoken, 'en');
  });
  $('#favouriteButton').addEventListener('click', toggleFavourite);
  localizedDetails.innerHTML = '<div class="localized-empty">Choose a language and press “Translate full details” to translate the definitions and examples.</div>';
  addDetailsControls();
}

function addDetailsControls() {
  const toolbar = document.createElement('div');
  toolbar.className = 'details-toolbar';
  toolbar.innerHTML =
    '<div><span class="section-kicker">MULTILINGUAL DICTIONARY</span><h3>Detailed meanings in your language</h3></div>' +
    '<div class="details-actions"><label class="sr-only" for="detailLanguageSelect">Choose detail language</label>' +
    '<select id="detailLanguageSelect" class="language-select">' +
    '<option value="ur">Urdu — اردو</option><option value="ar">Arabic — العربية</option><option value="hi">Hindi — हिन्दी</option>' +
    '<option value="es">Spanish — Español</option><option value="fr">French — Français</option><option value="de">German — Deutsch</option>' +
    '<option value="it">Italian — Italiano</option><option value="tr">Turkish — Türkçe</option><option value="zh-CN">Chinese — 中文</option>' +
    '<option value="ja">Japanese — 日本語</option><option value="pt">Portuguese — Português</option><option value="ru">Russian — Русский</option>' +
    '<option value="bn">Bengali — বাংলা</option><option value="pa">Punjabi — ਪੰਜਾਬੀ</option><option value="ko">Korean — 한국어</option><option value="nl">Dutch — Nederlands</option>' +
    '</select><button id="translateDetailsButton" class="translate-button" type="button">Translate full details →</button></div>';
  localizedDetails.prepend(toolbar);
  $('#translateDetailsButton').addEventListener('click', translateFullDetails);
}

function makeMeaningKey(word, language, original, translated) {
  return [word.toLowerCase(), language, original, translated].join('::');
}

function renderSavedMeanings() {
  const list = $('#savedMeaningsList');
  if (!savedMeanings.length) {
    list.innerHTML = '<p class="no-history">No saved meanings yet. Use “Save meaning” beside a translated definition.</p>';
    return;
  }
  list.innerHTML = savedMeanings.map((item, index) =>
    '<article class="saved-meaning-item"><div class="saved-meaning-meta">' + escapeHtml(item.word) + ' · ' + escapeHtml(item.languageName) +
    ' · ' + escapeHtml(item.partOfSpeech) + '</div><p>' + escapeHtml(item.translatedDefinition) + '</p>' +
    (item.translatedExample ? '<div class="example-box">“' + escapeHtml(item.translatedExample) + '”</div>' : '') +
    '<p class="saved-original"><strong>English:</strong> ' + escapeHtml(item.definition) + '</p>' +
    '<button type="button" class="text-speak-button" data-saved-speak="' + index + '">🔊 Listen</button> ' +
    '<button type="button" class="text-speak-button" data-saved-delete="' + index + '">Remove</button></article>'
  ).join('');
  list.querySelectorAll('[data-saved-speak]').forEach(button => button.addEventListener('click', () => {
    const item = savedMeanings[Number(button.dataset.savedSpeak)];
    speakText(item.translatedDefinition + (item.translatedExample ? '. ' + item.translatedExample : ''), item.language);
  }));
  list.querySelectorAll('[data-saved-delete]').forEach(button => button.addEventListener('click', () => {
    savedMeanings.splice(Number(button.dataset.savedDelete), 1);
    localStorage.setItem('wordwise-saved-meanings', JSON.stringify(savedMeanings));
    renderSavedMeanings();
    showToast('Saved meaning removed');
  }));
}

function toggleFavourite() {
  const exists = favourites.some(word => word.toLowerCase() === currentWord.toLowerCase());
  favourites = exists
    ? favourites.filter(word => word.toLowerCase() !== currentWord.toLowerCase())
    : [currentWord, ...favourites];
  localStorage.setItem('wordwise-favourites', JSON.stringify(favourites));
  const button = $('#favouriteButton');
  if (button) {
    button.textContent = exists ? '♡' : '♥';
    button.classList.toggle('saved', !exists);
  }
  showToast(exists ? 'Removed from favourites' : 'Added to favourites');
}

async function translateText(text, targetLanguage) {
  const url = 'https://api.mymemory.translated.net/get?q=' + encodeURIComponent(text) +
    '&langpair=' + encodeURIComponent('en|' + targetLanguage);
  const response = await fetch(url);
  if (!response.ok) throw new Error('Translation service returned HTTP ' + response.status);
  const data = await response.json();
  const translated = data?.responseData?.translatedText;
  if (!translated || Number(data.responseStatus) !== 200) {
    throw new Error(data?.responseDetails || 'No translation was returned.');
  }
  return translated;
}

async function translateFullDetails() {
  if (!currentEntry) return;
  const button = $('#translateDetailsButton');
  const target = $('#detailLanguageSelect').value;
  const requestedEntry = currentEntry;
  const requestedWord = currentWord;
  const items = getDefinitionItems(currentEntry);
  localizedDetails.querySelector('.localized-empty')?.remove();
  localizedDetails.querySelector('.translation-error')?.remove();
  if (!items.length) {
    localizedDetails.insertAdjacentHTML('beforeend', '<p class="translation-error">No definitions are available to translate.</p>');
    return;
  }
  button.disabled = true;
  button.textContent = 'Translating details…';
  const output = [];
  try {
    // Keep requests sequential to reduce the chance of hitting free API rate limits.
    for (const item of items) {
      const translatedDefinition = await translateText(item.definition, target);
      let translatedExample = '';
      if (item.example) {
        try { translatedExample = await translateText(item.example, target); }
        catch (_) { translatedExample = ''; }
      }
      output.push({ ...item, translatedDefinition, translatedExample });
    }
    if (currentEntry !== requestedEntry || currentWord !== requestedWord) return;
    const languageName = $('#detailLanguageSelect').selectedOptions[0].textContent;
    const html = '<div class="localized-heading"><div><span class="section-kicker">TRANSLATED DICTIONARY</span><h3>' +
      escapeHtml(languageName) + ' — ' + escapeHtml(currentEntry.word || currentWord) +
      '</h3></div><button type="button" class="icon-button" id="speakAllDetails" title="Read translated details aloud" aria-label="Read translated details aloud">🔊</button></div>' +
      output.map((item, index) => {
        const key = makeMeaningKey(requestedWord, target, item.definition, item.translatedDefinition);
        const isSaved = savedMeanings.some(saved => saved.key === key);
        return '<article class="localized-definition"><span class="part-of-speech">' + escapeHtml(item.partOfSpeech) +
          '</span><p><span class="meaning-number">' + (index + 1) + '.</span>' +
          escapeHtml(item.translatedDefinition) + '</p>' +
          (item.translatedExample ? '<div class="example-box">“' + escapeHtml(item.translatedExample) + '”</div>' : '') +
          '<div class="meaning-actions"><button type="button" class="text-speak-button" data-speak-index="' + index + '">🔊 Listen</button>' +
          '<button type="button" class="text-speak-button" data-save-index="' + index + '">' +
          (isSaved ? '♥ Saved' : '♡ Save meaning') + '</button></div></article>';
      }).join('');
    localizedDetails.querySelector('.localized-results')?.remove();
    const results = document.createElement('div');
    results.className = 'localized-results';
    results.innerHTML = html;
    localizedDetails.appendChild(results);
    $('#speakAllDetails').addEventListener('click', () => {
      speakText(output.map(item => item.translatedDefinition +
        (item.translatedExample ? '. ' + item.translatedExample : '')).join('. '), target);
    });
    results.querySelectorAll('[data-save-index]').forEach(saveButton => saveButton.addEventListener('click', () => {
      const item = output[Number(saveButton.dataset.saveIndex)];
      const key = makeMeaningKey(requestedWord, target, item.definition, item.translatedDefinition);
      const existing = savedMeanings.findIndex(saved => saved.key === key);
      if (existing >= 0) {
        savedMeanings.splice(existing, 1);
        saveButton.textContent = '♡ Save meaning';
        showToast('Meaning removed from saved list');
      } else {
        savedMeanings.unshift({ key, word: requestedWord, language: target, languageName,
          partOfSpeech: item.partOfSpeech, definition: item.definition,
          translatedDefinition: item.translatedDefinition, example: item.example,
          translatedExample: item.translatedExample, savedAt: Date.now() });
        saveButton.textContent = '♥ Saved';
        showToast('Meaning saved');
      }
      localStorage.setItem('wordwise-saved-meanings', JSON.stringify(savedMeanings));
    }));
    results.querySelectorAll('[data-speak-index]').forEach(speakButton => {
      speakButton.addEventListener('click', () => {
        const item = output[Number(speakButton.dataset.speakIndex)];
        speakText(item.translatedDefinition + (item.translatedExample ? '. ' + item.translatedExample : ''), target);
      });
    });
  } catch (error) {
    const existing = localizedDetails.querySelector('.translation-error');
    if (existing) existing.remove();
    localizedDetails.insertAdjacentHTML('beforeend',
      '<p class="translation-error">Could not translate all details. ' + escapeHtml(error.message) +
      ' Please try again in a moment or choose another language.</p>');
  } finally {
    button.disabled = false;
    button.textContent = 'Translate full details →';
  }
}

async function searchWord(rawWord) {
  const word = rawWord.trim();
  if (!word) return;
  if (!/^[\p{L}\p{M}' -]+$/u.test(word)) {
    showToast('Please enter a valid word using letters.');
    return;
  }
  const thisSearch = ++searchSequence;
  currentWord = word;
  currentEntry = null;
  input.value = word;
  translateButton.disabled = false;
  translationResult.innerHTML = '<span class="translation-placeholder">Ready to translate “' + escapeHtml(word) + '”.</span>';
  resultKicker.textContent = 'DICTIONARY RESULT';
  localizedDetails.innerHTML = '<div class="localized-empty">Search result loaded below. You can translate its detailed meanings into another language.</div>';
  resultArea.innerHTML = '<div class="empty-state"><div class="empty-icon">…</div><h2>Looking up your word</h2><p>Finding definitions and examples for “' + escapeHtml(word) + '”.</p></div>';
  try {
    const response = await fetch('https://api.dictionaryapi.dev/api/v2/entries/en/' + encodeURIComponent(word));
    if (!response.ok) {
      if (response.status === 404) throw new Error('Word not found. Check the spelling or try another English word.');
      throw new Error('Dictionary service is temporarily unavailable. Please try again.');
    }
    const data = await response.json();
    if (thisSearch !== searchSequence) return;
    if (!Array.isArray(data) || !data.length) throw new Error('No definition was found for this word.');
    renderWord(data[0]);
    saveHistory(word);
  } catch (error) {
    if (thisSearch !== searchSequence) return;
    // If the English dictionary has no entry, still try translating the real-world
    // word/phrase with source-language auto detection instead of stopping at 404.
    try {
      const target = document.querySelector('#plusTargetLanguage')?.value || 'ur';
      const url = 'https://api.mymemory.translated.net/get?q=' + encodeURIComponent(word) +
        '&langpair=' + encodeURIComponent('autodetect|' + target);
      const fallbackResponse = await fetch(url);
      const fallbackData = await fallbackResponse.json();
      const translated = fallbackData?.responseData?.translatedText;
      if (fallbackResponse.ok && translated && Number(fallbackData.responseStatus) === 200) {
        if (thisSearch !== searchSequence) return;
        resultArea.innerHTML = '<div class="word-top"><div><h2 class="word-title">' + escapeHtml(word) +
          '</h2><div class="phonetic">Dictionary definition unavailable — automatic language detection used</div></div></div>' +
          '<div class="part-of-speech">Translation / meaning</div><p class="definition">' + escapeHtml(translated) +
          '</p><p class="api-note">This is a machine translation, not a verified dictionary definition.</p>';
        translationResult.textContent = translated;
        localizedDetails.innerHTML = '<div class="localized-empty">The dictionary provider did not return a formal definition for this term. The translation above is the available meaning.</div>';
        saveHistory(word);
        return;
      }
    } catch (_) { /* Show the original lookup error below. */ }
    if (thisSearch !== searchSequence) return;
    resultArea.innerHTML = '<div class="empty-state"><div class="empty-icon">?</div><h2>We couldn’t find a definition or translation.</h2><p>' + escapeHtml(error.message) + ' Try the paragraph translator below or choose another target language.</p></div>';
    showToast(error.message);
  }
}

async function translateWord() {
  if (!currentWord) return;
  const target = languageSelect.value;
  translateButton.disabled = true;
  translateButton.textContent = 'Translating…';
  translationResult.textContent = 'Please wait…';
  try {
    const translated = await translateText(currentWord, target);
    translationResult.innerHTML = '<span>' + escapeHtml(translated) + '</span> ' +
      '<button type="button" class="icon-button speak-translation" aria-label="Listen to translation" title="Listen to translation">🔊</button>';
    translationResult.querySelector('.speak-translation').addEventListener('click', () => speakText(translated, target));
  } catch (error) {
    translationResult.textContent = 'Could not translate this word. ' + error.message;
  } finally {
    translateButton.disabled = !currentWord;
    translateButton.innerHTML = 'Translate word <span>→</span>';
  }
}

$('#year').textContent = new Date().getFullYear();
form.addEventListener('submit', event => {
  event.preventDefault();
  searchWord(input.value);
});
document.querySelectorAll('.example-word').forEach(button =>
  button.addEventListener('click', () => searchWord(button.textContent))
);
translateButton.addEventListener('click', translateWord);
$('#savedMeaningsToggle').addEventListener('click', () => {
  renderSavedMeanings();
  $('#savedMeaningsModal').classList.add('open');
});
$('#closeSavedMeanings').addEventListener('click', () => $('#savedMeaningsModal').classList.remove('open'));
$('#savedMeaningsModal').addEventListener('click', event => {
  if (event.target.id === 'savedMeaningsModal') event.currentTarget.classList.remove('open');
});
$('#historyToggle').addEventListener('click', () => {
  renderHistory();
  $('#historyModal').classList.add('open');
});
$('#closeHistory').addEventListener('click', () => $('#historyModal').classList.remove('open'));
$('#historyModal').addEventListener('click', event => {
  if (event.target.id === 'historyModal') event.currentTarget.classList.remove('open');
});
$('#clearHistory').addEventListener('click', () => {
  history = [];
  localStorage.removeItem('wordwise-history');
  renderHistory();
  showToast('Search history cleared');
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape') {
    $('#historyModal').classList.remove('open');
    $('#savedMeaningsModal').classList.remove('open');
  }
});


// WordWise Plus: paragraph translation, PDF text extraction/OCR, and speech controls.
(function initWordWisePlus(){
  const $p = (s) => document.querySelector(s);
  const languages = [
    ["ur","Urdu — اردو"],["pa","Punjabi (Pakistan) — پنجابی"],["sd","Sindhi — سنڌي"],["skr","Saraiki — سرائیکی"],
    ["en","English"],["ar","Arabic"],["hi","Hindi"],["es","Spanish"],["fr","French"],["de","German"],["it","Italian"],["pt","Portuguese"],["ru","Russian"],["zh-CN","Chinese (Simplified)"],["zh-TW","Chinese (Traditional)"],["ja","Japanese"],["ko","Korean"],["nl","Dutch"],["bn","Bengali"],["tr","Turkish"],["fa","Persian"],["ps","Pashto"],["gu","Gujarati"],["mr","Marathi"],["ta","Tamil"],["te","Telugu"],["ml","Malayalam"],["kn","Kannada"],["or","Odia"],["as","Assamese"],["ne","Nepali"],["si","Sinhala"],["th","Thai"],["vi","Vietnamese"],["id","Indonesian"],["ms","Malay"],["fil","Filipino"],["sw","Swahili"],["am","Amharic"],["ha","Hausa"],["yo","Yoruba"],["ig","Igbo"],["zu","Zulu"],["af","Afrikaans"],["sq","Albanian"],["hy","Armenian"],["az","Azerbaijani"],["eu","Basque"],["be","Belarusian"],["bs","Bosnian"],["bg","Bulgarian"],["ca","Catalan"],["hr","Croatian"],["cs","Czech"],["da","Danish"],["et","Estonian"],["fi","Finnish"],["gl","Galician"],["ka","Georgian"],["el","Greek"],["he","Hebrew"],["hu","Hungarian"],["is","Icelandic"],["ga","Irish"],["kk","Kazakh"],["km","Khmer"],["ky","Kyrgyz"],["lo","Lao"],["lv","Latvian"],["lt","Lithuanian"],["lb","Luxembourgish"],["mk","Macedonian"],["mg","Malagasy"],["mt","Maltese"],["mn","Mongolian"],["my","Myanmar"],["no","Norwegian"],["pl","Polish"],["ro","Romanian"],["sr","Serbian"],["sk","Slovak"],["sl","Slovenian"],["so","Somali"],["sv","Swedish"],["tg","Tajik"],["tk","Turkmen"],["uk","Ukrainian"],["uz","Uzbek"],["cy","Welsh"],["yi","Yiddish"],["la","Latin"],["eo","Esperanto"],["haw","Hawaiian"],["ceb","Cebuano"],["jv","Javanese"],["su","Sundanese"],["ny","Chichewa"],["co","Corsican"],["ht","Haitian Creole"],["ku","Kurdish"],["sd","Sindhi"]
  ];
  const uniqueLanguages = [...new Map(languages.map(x=>[x[0],x])).values()];
  const panel = document.createElement('section');
  panel.className = 'plus-panel';
  panel.id = 'sentence-tools';
  panel.innerHTML = '<div class="section-kicker">WORDWISE PLUS</div><h2>Translate a sentence, paragraph or PDF</h2><p class="plus-intro">Paste text or upload a PDF. WordWise will translate the text and show a sentence-by-sentence version where the provider supports the selected language.</p><label for="paragraphInput">Your text</label><textarea id="paragraphInput" rows="6" placeholder="Write or paste a complete sentence or paragraph here…"></textarea><div class="voice-input-controls"><label for="voiceInputLanguage">Speak in</label><select id="voiceInputLanguage"><option value="ur-PK">Urdu (Pakistan)</option><option value="en-US">English</option><option value="pa-IN">Punjabi</option><option value="hi-IN">Hindi</option><option value="ar-SA">Arabic</option></select><button id="startVoiceInput" class="translate-button" type="button">🎙️ Speak instruction</button><span id="voiceInputStatus" class="api-note" role="status">Press the microphone and speak. The recognized text will be translated into your selected target language.</span></div><div class="plus-controls"><div><label for="plusTargetLanguage">Translate into</label><select id="plusTargetLanguage"></select></div><button id="translateParagraph" class="translate-button" type="button">Translate & explain →</button></div><div class="pdf-controls"><label for="pdfUpload">PDF scanner (select a PDF)</label><input id="pdfUpload" type="file" accept="application/pdf,.pdf"><button id="scanPdf" class="translate-button" type="button">Extract PDF text / OCR</button><span id="pdfStatus" class="api-note" role="status">Text-based PDFs are extracted directly. Scanned pages may need OCR and can take longer.</span></div><div id="paragraphOutput" class="paragraph-output" aria-live="polite"><span class="translation-placeholder">Your translation and sentence meanings will appear here.</span></div><div class="speech-controls"><strong>Voice controls</strong><button type="button" id="speechPause">Ⅱ Pause</button><button type="button" id="speechResume">▶ Resume</button><button type="button" id="speechStop">■ Stop</button><span id="speechState" class="api-note">Control spoken text while it is playing.</span></div>';
  const features = document.querySelector('.features');
  (features || document.querySelector('main')).before(panel);
  const target = $p('#plusTargetLanguage');
  target.innerHTML = uniqueLanguages.map(([code,name])=>'<option value="'+code+'">'+name+'</option>').join('');
  target.value='ur';

  const sourceText = (text) => text.trim();
  async function translateAuto(text, targetCode) {
    const chunks = text.match(/[\s\S]{1,430}(?:\s|$)|[\s\S]{1,430}/g) || [];
    const translated = [];
    for (const chunk of chunks) {
      const url='https://api.mymemory.translated.net/get?q='+encodeURIComponent(chunk.trim())+'&langpair='+encodeURIComponent('autodetect|'+targetCode);
      const response=await fetch(url);
      if(!response.ok) throw new Error('Translation service HTTP '+response.status);
      const data=await response.json();
      const value=data?.responseData?.translatedText;
      if(!value || Number(data.responseStatus)!==200) throw new Error(data?.responseDetails || 'Provider did not return a translation for this language.');
      translated.push(value);
    }
    return translated.join(' ');
  }
  let speakAfterVoiceTranslation = false;
  const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
  const voiceInputButton = $p('#startVoiceInput');
  if (SpeechRecognitionAPI) {
    const recognition = new SpeechRecognitionAPI();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    voiceInputButton.addEventListener('click', () => {
      recognition.lang = $p('#voiceInputLanguage').value;
      $p('#voiceInputStatus').textContent = 'Listening… please speak now.';
      voiceInputButton.disabled = true;
      try { recognition.start(); }
      catch (error) {
        voiceInputButton.disabled = false;
        $p('#voiceInputStatus').textContent = 'Microphone could not start. Allow microphone permission and try again.';
      }
    });
    recognition.onresult = (event) => {
      const spokenText = event.results?.[0]?.[0]?.transcript?.trim();
      if (!spokenText) {
        $p('#voiceInputStatus').textContent = 'No speech was detected. Please try again.';
        return;
      }
      $p('#paragraphInput').value = spokenText;
      $p('#voiceInputStatus').textContent = 'You said: “' + spokenText + '” — translating now…';
      speakAfterVoiceTranslation = true;
      $p('#translateParagraph').click();
    };
    recognition.onerror = (event) => {
      const messages = {
        'not-allowed': 'Microphone permission was blocked. Allow microphone access in your browser settings.',
        'no-speech': 'No speech detected. Please speak a little louder and try again.',
        'audio-capture': 'No microphone was found. Check your microphone connection.'
      };
      $p('#voiceInputStatus').textContent = messages[event.error] || ('Voice recognition error: ' + event.error);
    };
    recognition.onend = () => { voiceInputButton.disabled = false; };
  } else {
    voiceInputButton.disabled = true;
    $p('#voiceInputStatus').textContent = 'Voice input is not supported here. Open WordWise in an updated Chrome or Edge browser.';
  }

  $p('#translateParagraph').addEventListener('click', async()=>{
    const text=sourceText($p('#paragraphInput').value);
    const out=$p('#paragraphOutput');
    if(!text){out.textContent='Please enter a sentence or paragraph first.';return;}
    const btn=$p('#translateParagraph'), code=target.value;
    btn.disabled=true;btn.textContent='Translating…';out.textContent='Translating your text. Please wait…';
    try{
      const whole=await translateAuto(text,code);
      const sentences=text.match(/[^.!?۔]+[.!?۔]?/gu)?.map(s=>s.trim()).filter(Boolean)||[text];
      const parts=[];
      for(const sentence of sentences.slice(0,30)){
        try{parts.push({source:sentence,translated:await translateAuto(sentence,code)});}
        catch(_){parts.push({source:sentence,translated:'Sentence translation was unavailable.'});}
      }
      const langName=uniqueLanguages.find(x=>x[0]===code)?.[1]||code;
      out.innerHTML='<div class="localized-heading"><h3>Full translation — '+escapeHtml(langName)+'</h3><button type="button" class="text-speak-button" id="speakParagraphResult">🔊 Listen</button></div><p class="paragraph-full">'+escapeHtml(whole)+'</p><h3>Sentence-by-sentence meaning</h3>'+parts.map((p,i)=>'<article class="sentence-meaning"><b>'+ (i+1)+'. '+escapeHtml(p.source)+'</b><p>'+escapeHtml(p.translated)+'</p></article>').join('')+'<p class="api-note">This is a machine translation, not a human-written interpretation. Verify important or formal translations.</p>';
      $p('#speakParagraphResult').addEventListener('click',()=>window.speechSynthesis&&speakText(whole,code));
      if (speakAfterVoiceTranslation) { speakAfterVoiceTranslation = false; speakText(whole, code); $p('#voiceInputStatus').textContent = 'Voice answer is playing. You can speak another instruction anytime.'; }
    }catch(err){speakAfterVoiceTranslation=false;out.textContent='Translation could not be completed: '+err.message+' The provider may not support this language pair.';}
    finally{btn.disabled=false;btn.textContent='Translate & explain →';}
  });

  $p('#scanPdf').addEventListener('click',async()=>{
    const file=$p('#pdfUpload').files[0], status=$p('#pdfStatus'), textarea=$p('#paragraphInput');
    if(!file){status.textContent='Please choose a PDF file first.';return;}
    if(!window.pdfjsLib){status.textContent='PDF reader could not load. Check your internet connection and reload.';return;}
    status.textContent='Reading PDF…';
    try{
      const pdf=await window.pdfjsLib.getDocument({data:await file.arrayBuffer()}).promise;
      let allText='';
      const pageCount=Math.min(pdf.numPages,20);
      for(let n=1;n<=pageCount;n++){
        status.textContent='Reading page '+n+' of '+pageCount+'…';
        const page=await pdf.getPage(n), content=await page.getTextContent();
        let pageText=content.items.map(item=>item.str).join(' ').trim();
        if(pageText.length<20){
          status.textContent='Scanned page '+n+': preparing OCR…';
          if(!window.Tesseract){
            await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';s.onload=resolve;s.onerror=reject;document.head.appendChild(s);});
          }
          const viewport=page.getViewport({scale:1.5}), canvas=document.createElement('canvas');
          canvas.width=viewport.width;canvas.height=viewport.height;
          await page.render({canvasContext:canvas.getContext('2d'),viewport}).promise;
          const result=await window.Tesseract.recognize(canvas,'eng+urd');
          pageText=result.data.text||'';
        }
        allText+='\n\n'+pageText;
      }
      textarea.value=allText.trim();
      status.textContent='Finished. Extracted text from '+pageCount+' page(s). Review OCR text for mistakes before translating.';
      if(pdf.numPages>20) status.textContent+=' Only the first 20 pages were processed.';
    }catch(err){status.textContent='PDF could not be read: '+err.message;}
  });
  if('speechSynthesis' in window){
    $p('#speechPause').addEventListener('click',()=>{window.speechSynthesis.pause();$p('#speechState').textContent='Speech paused.';});
    $p('#speechResume').addEventListener('click',()=>{window.speechSynthesis.resume();$p('#speechState').textContent='Speech resumed.';});
    $p('#speechStop').addEventListener('click',()=>{window.speechSynthesis.cancel();$p('#speechState').textContent='Speech stopped.';});
  }else{$p('#speechState').textContent='Speech controls are not supported in this browser.';}
})();
