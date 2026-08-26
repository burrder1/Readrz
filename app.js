const MAX_PAGES = 10;

let pages = [];
let currentPage = 0;
let voices = [];
let isSpeaking = false;

const cameraInput = document.getElementById("cameraInput");
const scanBtn = document.getElementById("scanBtn");

const pageCount = document.getElementById("pageCount");
const pageTotal = document.getElementById("pageTotal");

const textBuffer = document.getElementById("textBuffer");
const filmstrip = document.getElementById("filmstrip");
const filmstripEmpty = document.getElementById("filmstripEmpty");

const voiceSelect = document.getElementById("voiceSelect");
const rateSlider = document.getElementById("rateSlider");
const rateValue = document.getElementById("rateValue");

const playBtn = document.getElementById("playBtn");
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");

const previousWordBtn = document.getElementById("previousWordBtn");
const nextWordBtn = document.getElementById("nextWordBtn");

const clearBtn = document.getElementById("clearBtn");

const statusLine = document.getElementById("statusLine");
const ocrProgress = document.getElementById("ocrProgress");
const ocrPercent = document.getElementById("ocrPercent");


/* -----------------------------
   STARTUP
----------------------------- */

pageTotal.textContent = String(MAX_PAGES).padStart(2, "0");

loadVoices();

if ("speechSynthesis" in window) {
  speechSynthesis.onvoiceschanged = loadVoices;
}

updateDisplay();


/* -----------------------------
   VOICES
----------------------------- */

function loadVoices() {

  if (!("speechSynthesis" in window)) {
    voiceSelect.innerHTML = "<option>Speech unavailable</option>";
    return;
  }

  voices = speechSynthesis.getVoices();

  if (!voices.length) {
    return;
  }

  voiceSelect.innerHTML = "";

  voices.forEach((voice, index) => {

    const option = document.createElement("option");

    option.value = index;

    option.textContent =
      `${voice.name} — ${voice.lang}`;

    voiceSelect.appendChild(option);
  });

  const preferred =
    voices.findIndex(v =>
      /en-US/i.test(v.lang)
    );

  if (preferred >= 0) {
    voiceSelect.value = preferred;
  }
}


/* -----------------------------
   SCAN BUTTON
----------------------------- */

scanBtn.addEventListener("click", () => {
  cameraInput.click();
});


cameraInput.addEventListener("change", async event => {

  const file = event.target.files[0];

  if (!file) {
    return;
  }

  await scanPage(file);

  cameraInput.value = "";
});


/* -----------------------------
   OCR
----------------------------- */

async function scanPage(file) {

  if (pages.length >= MAX_PAGES) {

    setStatus("INVENTORY FULL.");

    return;
  }

  setStatus("SCANNING PAGE...");
  setProgress(0);

  scanBtn.disabled = true;
  scanBtn.textContent = "◆ SCANNING ◆";

  try {

    if (typeof Tesseract === "undefined") {
      throw new Error("OCR ENGINE NOT LOADED");
    }

    const result = await Tesseract.recognize(
      file,
      "eng",
      {
        logger: message => {

          if (
            message.status === "recognizing text" &&
            typeof message.progress === "number"
          ) {

            const percent =
              Math.round(message.progress * 100);

            setProgress(percent);

            setStatus(`READING PAGE... ${percent}%`);
          }

          else if (message.status) {

            const label =
              message.status
                .replace(/_/g, " ")
                .toUpperCase();

            setStatus(label + "...");
          }
        }
      }
    );

    const text =
      result.data.text
        .replace(/\n{3,}/g, "\n\n")
        .trim();

    if (!text) {

      setStatus("NO TEXT FOUND.");

      return;
    }

    const imageURL =
      URL.createObjectURL(file);

    pages.push({
      text: text,
      image: imageURL
    });

    currentPage = pages.length - 1;

    setProgress(100);
    setStatus("PAGE READ. QUEST UPDATED.");

    updateDisplay();

  }

  catch (error) {

    console.error(error);

    setStatus("OCR FAILED.");

    textBuffer.textContent =
      "THE PAGE COULD NOT BE READ.\n\nTRY AGAIN WITH BETTER LIGHT.";
  }

  finally {

    scanBtn.disabled = false;
    scanBtn.textContent = "▲ SCAN PAGE";
  }
}


/* -----------------------------
   DISPLAY
----------------------------- */

function updateDisplay() {

  const number =
    pages.length === 0
      ? 0
      : currentPage + 1;

  pageCount.textContent =
    String(number).padStart(2, "0");

  pageTotal.textContent =
    String(MAX_PAGES).padStart(2, "0");

  renderText();
  renderFilmstrip();
}


function renderText() {

  if (!pages.length) {

    textBuffer.innerHTML = `
      READY.<span class="cursor">_</span>
      <br><br>
      NO PAGES YET.<br><br>
      SCAN A PAGE TO<br>
      BEGIN YOUR QUEST.
    `;

    return;
  }

  textBuffer.textContent =
    pages[currentPage].text;
}


/* -----------------------------
   FILMSTRIP
----------------------------- */

function renderFilmstrip() {

  filmstrip.innerHTML = "";

  if (!pages.length) {

    filmstrip.appendChild(filmstripEmpty);

    return;
  }

  pages.forEach((page, index) => {

    const card =
      document.createElement("div");

    card.className = "page-card";

    if (index === currentPage) {
      card.classList.add("active");
    }

    const img =
      document.createElement("img");

    img.src = page.image;

    img.alt = `Page ${index + 1}`;

    card.appendChild(img);

    card.addEventListener("click", () => {

      stopSpeaking();

      currentPage = index;

      updateDisplay();

      setStatus(
        `PAGE ${String(index + 1).padStart(2, "0")} LOADED.`
      );
    });

    filmstrip.appendChild(card);
  });
}


/* -----------------------------
   PLAY / SPEECH
----------------------------- */

playBtn.addEventListener("click", () => {

  if (!pages.length) {

    setStatus("SCAN A PAGE FIRST.");

    return;
  }

  if (!("speechSynthesis" in window)) {

    setStatus("SPEECH NOT SUPPORTED.");

    return;
  }

  if (isSpeaking) {

    stopSpeaking();

    return;
  }

  const text =
    pages[currentPage].text;

  if (!text.trim()) {

    setStatus("NO TEXT TO READ.");

    return;
  }

  const utterance =
    new SpeechSynthesisUtterance(text);

  const selectedVoice =
    voices[voiceSelect.value];

  if (selectedVoice) {
    utterance.voice = selectedVoice;
  }

  utterance.rate =
    Number(rateSlider.value);

  utterance.pitch = 1;

  utterance.volume = 1;

  utterance.onstart = () => {

    isSpeaking = true;

    playBtn.textContent = "■";

    setStatus("READING PAGE...");
  };

  utterance.onend = () => {

    isSpeaking = false;

    playBtn.textContent = "▶";

    setStatus("PAGE COMPLETE.");
  };

  utterance.onerror = () => {

    isSpeaking = false;

    playBtn.textContent = "▶";

    setStatus("SPEECH ERROR.");
  };

  speechSynthesis.cancel();

  speechSynthesis.speak(utterance);
});


function stopSpeaking() {

  if ("speechSynthesis" in window) {
    speechSynthesis.cancel();
  }

  isSpeaking = false;

  playBtn.textContent = "▶";
}


/* -----------------------------
   PAGE NAVIGATION
----------------------------- */

prevBtn.addEventListener("click", () => {

  if (!pages.length) {
    setStatus("NO PAGES.");
    return;
  }

  stopSpeaking();

  currentPage--;

  if (currentPage < 0) {
    currentPage = pages.length - 1;
  }

  updateDisplay();

  setStatus(
    `PAGE ${currentPage + 1} LOADED.`
  );
});


nextBtn.addEventListener("click", () => {

  if (!pages.length) {
    setStatus("NO PAGES.");
    return;
  }

  stopSpeaking();

  currentPage++;

  if (currentPage >= pages.length) {
    currentPage = 0;
  }

  updateDisplay();

  setStatus(
    `PAGE ${currentPage + 1} LOADED.`
  );
});


/* -----------------------------
   SPEECH POSITION CONTROLS
----------------------------- */

previousWordBtn.addEventListener("click", () => {

  setStatus("PREVIOUS SECTION.");

  stopSpeaking();

  if (pages.length) {
    speakText(pages[currentPage].text);
  }
});


nextWordBtn.addEventListener("click", () => {

  setStatus("NEXT SECTION.");

  stopSpeaking();

  if (pages.length) {
    speakText(pages[currentPage].text);
  }
});


function speakText(text) {

  if (!("speechSynthesis" in window)) {
    return;
  }

  const utterance =
    new SpeechSynthesisUtterance(text);

  const selectedVoice =
    voices[voiceSelect.value];

  if (selectedVoice) {
    utterance.voice = selectedVoice;
  }

  utterance.rate =
    Number(rateSlider.value);

  speechSynthesis.speak(utterance);

  isSpeaking = true;

  playBtn.textContent = "■";

  utterance.onend = () => {

    isSpeaking = false;

    playBtn.textContent = "▶";
  };
}


/* -----------------------------
   SPEED
----------------------------- */

rateSlider.addEventListener("input", () => {

  const value =
    Number(rateSlider.value);

  rateValue.textContent =
    `${value.toFixed(2)}x`;

  if (isSpeaking) {

    speechSynthesis.cancel();

    setStatus("SPEED CHANGED.");
  }
});


/* -----------------------------
   CLEAR
----------------------------- */

clearBtn.addEventListener("click", () => {

  if (!pages.length) {

    setStatus("INVENTORY ALREADY EMPTY.");

    return;
  }

  stopSpeaking();

  const confirmed =
    confirm("CLEAR ALL PAGES?");

  if (!confirmed) {
    return;
  }

  pages.forEach(page => {

    if (page.image) {
      URL.revokeObjectURL(page.image);
    }
  });

  pages = [];

  currentPage = 0;

  setProgress(0);

  setStatus("INVENTORY CLEARED.");

  updateDisplay();
});


/* -----------------------------
   STATUS
----------------------------- */

function setStatus(message) {

  statusLine.textContent =
    message.toUpperCase();
}


function setProgress(value) {

  const safeValue =
    Math.max(0, Math.min(100, value));

  ocrProgress.style.width =
    `${safeValue}%`;

  ocrPercent.textContent =
    `${safeValue}%`;
}


/* -----------------------------
   KEYBOARD CONTROLS
----------------------------- */

document.addEventListener("keydown", event => {

  if (event.code === "Space") {

    event.preventDefault();

    playBtn.click();
  }

  if (event.code === "ArrowLeft") {

    prevBtn.click();
  }

  if (event.code === "ArrowRight") {

    nextBtn.click();
  }

  if (event.key.toLowerCase() === "s") {

    scanBtn.click();
  }
});
