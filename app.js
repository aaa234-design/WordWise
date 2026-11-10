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
voiceGenderSelect.value = localStorage.getItem('wordwise-voice-style') || 'female';
voiceGenderSelect.addEventListener('change', () => {
  localStorage.setItem('wordwise-voice-style', voiceGenderSelect.value);
  localStorage.removeItem('wordwise-voice-id');
  voiceSelect.value = '';
  showToast('Voice preference saved');
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
  const items = getDefinitionItems(currentEntry);
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
    const languageName = $('#detailLanguageSelect').selectedOptions[0].textContent;
    const html = '<div class="localized-heading"><div><span class="section-kicker">TRANSLATED DICTIONARY</span><h3>' +
      escapeHtml(languageName) + ' — ' + escapeHtml(currentEntry.word || currentWord) +
      '</h3></div><button type="button" class="icon-button" id="speakAllDetails" title="Read translated details aloud" aria-label="Read translated details aloud">🔊</button></div>' +
      output.map((item, index) =>
        '<article class="localized-definition"><span class="part-of-speech">' + escapeHtml(item.partOfSpeech) +
        '</span><p><span class="meaning-number">' + (index + 1) + '.</span>' +
        escapeHtml(item.translatedDefinition) + '</p>' +
        (item.translatedExample ? '<div class="example-box">“' + escapeHtml(item.translatedExample) + '”</div>' : '') +
        '<button type="button" class="text-speak-button" data-speak-index="' + index + '">🔊 Listen to this meaning</button></article>'
      ).join('');
    localizedDetails.querySelector('.localized-results')?.remove();
    const results = document.createElement('div');
    results.className = 'localized-results';
    results.innerHTML = html;
    localizedDetails.appendChild(results);
    $('#speakAllDetails').addEventListener('click', () => {
      speakText(output.map(item => item.translatedDefinition +
        (item.translatedExample ? '. ' + item.translatedExample : '')).join('. '), target);
    });
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
    resultArea.innerHTML = '<div class="empty-state"><div class="empty-icon">?</div><h2>We couldn’t find that word.</h2><p>' + escapeHtml(error.message) + '</p></div>';
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
  if (event.key === 'Escape') $('#historyModal').classList.remove('open');
});
