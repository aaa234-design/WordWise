const $ = (selector) => document.querySelector(selector);
const form = $('#searchForm');
const input = $('#wordInput');
const resultArea = $('#resultArea');
const resultKicker = $('#resultKicker');
const translateButton = $('#translateButton');
const languageSelect = $('#languageSelect');
const translationResult = $('#translationResult');
let currentWord = '';
let currentAudio = '';
let currentEntry = null;

// Speak text using voices available in the visitor's browser/device.
function speakText(text, language = 'en') {
  if (!('speechSynthesis' in window)) { showToast('Voice playback is not supported in this browser.'); return; }
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = language;
  const voices = window.speechSynthesis.getVoices();
  const languageVoices = voices.filter(item => item.lang.toLowerCase() === language.toLowerCase() || item.lang.toLowerCase().startsWith(language.split('-')[0].toLowerCase()));
  const style = $('#voiceGenderSelect')?.value || 'female';
  const femaleNames = /female|woman|zira|samantha|victoria|karen|susan|aria|jenny|sara|google हिन्दी/i;
  const maleNames = /male|man|david|mark|daniel|james|george|guy|ryan|alex/i;
  const preferredVoice = style === 'default' ? null : languageVoices.find(item => (style === 'female' ? femaleNames : maleNames).test(item.name));
  const voice = preferredVoice || languageVoices[0] || voices.find(item => item.lang.toLowerCase().startsWith(language.split('-')[0].toLowerCase()));
  if (voice) utterance.voice = voice;
  if (style !== 'default' && languageVoices.length && !preferredVoice) {
    showToast('Selected voice not available for this language. Using an available voice.');
  }
  utterance.rate = 0.9;
  window.speechSynthesis.speak(utterance);
}
let history = JSON.parse(localStorage.getItem('wordwise-history') || '[]');
let favourites = JSON.parse(localStorage.getItem('wordwise-favourites') || '[]');

$('#year').textContent = new Date().getFullYear();
const voiceGenderSelect = $('#voiceGenderSelect');
if (voiceGenderSelect) {
  voiceGenderSelect.value = localStorage.getItem('wordwise-voice-style') || 'female';
  voiceGenderSelect.addEventListener('change', () => {
    localStorage.setItem('wordwise-voice-style', voiceGenderSelect.value);
    showToast('Voice preference saved');
  });
}

function showToast(message) {
  const toast = $('#toast');
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove('show'), 2400);
}
function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
}
function saveHistory(word) {
  history = [word, ...history.filter(item => item.toLowerCase() !== word.toLowerCase())].slice(0, 20);
  localStorage.setItem('wordwise-history', JSON.stringify(history));
}
function renderHistory() {
  const list = $('#historyList');
  if (!history.length) {
    list.innerHTML = '<p class="no-history">No searches yet. Your searched words will show up here.</p>';
    return;
  }
  list.innerHTML = history.map(word => '<div class="history-item"><button type="button" data-word="' + escapeHtml(word) + '">' + escapeHtml(word) + '</button><small>Search again ↗</small></div>').join('');
  list.querySelectorAll('[data-word]').forEach(button => button.addEventListener('click', () => {
    $('#historyModal').classList.remove('open');
    searchWord(button.dataset.word);
  }));
}
function renderWord(entry) {
  currentEntry = entry;
  const meanings = entry.meanings || [];
  const firstMeaning = meanings[0] || {};
  const definitions = firstMeaning.definitions || [];
  const phonetic = entry.phonetic || (entry.phonetics || []).find(item => item.text)?.text || 'Pronunciation not available';
  const audio = (entry.phonetics || []).find(item => item.audio)?.audio || '';
  currentAudio = audio;
  const saved = favourites.some(word => word.toLowerCase() === currentWord.toLowerCase());
  const meaningHtml = meanings.slice(0, 3).map((meaning, index) => {
    const defs = (meaning.definitions || []).slice(0, 2);
    return '<div class="part-of-speech">' + escapeHtml(meaning.partOfSpeech || 'Meaning') + '</div>' +
      defs.map((def, i) => '<p class="definition"><span class="meaning-number">' + (index + 1) + '.' + (i + 1) + '</span>' + escapeHtml(def.definition || '') + '</p>' +
      (def.example ? '<div class="example-box">“' + escapeHtml(def.example) + '”</div>' : '')).join('');
  }).join('');
  resultArea.innerHTML = '<div class="word-top"><div><h2 class="word-title">' + escapeHtml(entry.word || currentWord) + '</h2><div class="phonetic">' + escapeHtml(phonetic) + '</div></div><div class="word-actions">' +
    (audio ? '<button class="icon-button" id="audioButton" aria-label="Play pronunciation" title="Play pronunciation">♫</button>' : '') +
    '<button class="icon-button" id="speakDefinitionButton" aria-label="Read definition aloud" title="Read definition aloud">🔊</button>' +
    '<button class="icon-button ' + (saved ? 'saved' : '') + '" id="favouriteButton" aria-label="Save favourite" title="Save favourite">' + (saved ? '♥' : '♡') + '</button></div></div>' +
    meaningHtml + (meanings.length > 3 ? '<div class="more-meanings">+' + (meanings.length - 3) + ' more word meanings available</div>' : '');
  const audioButton = $('#audioButton');
  if (audioButton) audioButton.addEventListener('click', () => new Audio(currentAudio).play().catch(() => showToast('Audio could not be played.')));
  $('#speakDefinitionButton').addEventListener('click', () => {
    const spoken = meanings.map(m => (m.definitions || []).slice(0, 2).map(d => d.definition).join('. ')).join('. ');
    speakText((entry.word || currentWord) + '. ' + spoken, 'en');
  });
  $('#favouriteButton').addEventListener('click', toggleFavourite);
}
function toggleFavourite() {
  const exists = favourites.some(word => word.toLowerCase() === currentWord.toLowerCase());
  favourites = exists ? favourites.filter(word => word.toLowerCase() !== currentWord.toLowerCase()) : [currentWord, ...favourites];
  localStorage.setItem('wordwise-favourites', JSON.stringify(favourites));
  const button = $('#favouriteButton');
  if (button) { button.textContent = exists ? '♡' : '♥'; button.classList.toggle('saved', !exists); }
  showToast(exists ? 'Removed from favourites' : 'Added to favourites');
}
async function searchWord(rawWord) {
  const word = rawWord.trim();
  if (!word) return;
  if (!/^[\p{L}\p{M}' -]+$/u.test(word)) { showToast('Please enter a valid word.'); return; }
  currentWord = word;
  input.value = word;
  translateButton.disabled = false;
  translationResult.innerHTML = '<span class="translation-placeholder">Ready to translate “' + escapeHtml(word) + '”.</span>';
  resultKicker.textContent = 'DICTIONARY RESULT';
  resultArea.innerHTML = '<div class="empty-state"><div class="empty-icon">…</div><h2>Looking up your word</h2><p>Finding definitions and examples for “' + escapeHtml(word) + '”.</p></div>';
  try {
    const response = await fetch('https://api.dictionaryapi.dev/api/v2/entries/en/' + encodeURIComponent(word));
    if (!response.ok) {
      if (response.status === 404) throw new Error('Word not found. Check the spelling or try another English word.');
      throw new Error('Dictionary service is temporarily unavailable. Please try again.');
    }
    const data = await response.json();
    if (!Array.isArray(data) || !data.length) throw new Error('No definition was found for this word.');
    renderWord(data[0]);
    saveHistory(word);
  } catch (error) {
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
    const pair = 'en|' + target;
    const url = 'https://api.mymemory.translated.net/get?q=' + encodeURIComponent(currentWord) + '&langpair=' + encodeURIComponent(pair);
    const response = await fetch(url);
    if (!response.ok) throw new Error('Translation service is unavailable.');
    const data = await response.json();
    const translated = data?.responseData?.translatedText;
    if (!translated || data.responseStatus !== 200) throw new Error('Could not translate this word right now.');
    translationResult.innerHTML = '<span>' + escapeHtml(translated) + '</span> <button type="button" class="icon-button speak-translation" aria-label="Listen to translation" title="Listen to translation">🔊</button>';
    translationResult.querySelector('.speak-translation').addEventListener('click', () => speakText(translated, target));
  } catch (error) {
    translationResult.textContent = error.message;
  } finally {
    translateButton.disabled = false;
    translateButton.innerHTML = 'Translate word <span>→</span>';
  }
}
form.addEventListener('submit', event => { event.preventDefault(); searchWord(input.value); });
document.querySelectorAll('.example-word').forEach(button => button.addEventListener('click', () => searchWord(button.textContent)));
translateButton.addEventListener('click', translateWord);
$('#historyToggle').addEventListener('click', () => { renderHistory(); $('#historyModal').classList.add('open'); });
$('#closeHistory').addEventListener('click', () => $('#historyModal').classList.remove('open'));
$('#historyModal').addEventListener('click', event => { if (event.target.id === 'historyModal') event.currentTarget.classList.remove('open'); });
$('#clearHistory').addEventListener('click', () => { history = []; localStorage.removeItem('wordwise-history'); renderHistory(); showToast('Search history cleared'); });
document.addEventListener('keydown', event => { if (event.key === 'Escape') $('#historyModal').classList.remove('open'); });
