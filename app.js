/* =========================================================
   PAGE READER
   KOKORO LOCAL TTS + TESSERACT OCR
   ========================================================= */

import { KokoroTTS } from "https://cdn.jsdelivr.net/npm/kokoro-js@1.2.1/+esm";


/* =========================================================
   SETTINGS
   ========================================================= */

const MAX_PAGES = 10;

const KOKORO_MODEL = "onnx-community/Kokoro-82M-v1.0-ONNX";

const KOKORO_VOICES = [
  { id: "af_heart", name: "Heart — American Female" },
  { id: "af_bella", name: "Bella — American Female" },
  { id: "af_nicole", name: "Nicole — American Female" },
  { id: "af_sarah", name: "Sarah — American Female" },
  { id: "af_sky", name: "Sky — American Female" },

  { id: "am_adam", name: "Adam — American Male" },
  { id: "am_michael", name: "Michael — American Male" },
  { id: "am_fenrir", name: "Fenrir — American Male" },
  { id: "am_puck", name: "Puck — American Male" },

  { id: "bf_emma", name: "Emma — British Female" },
  { id: "bf_isabella", name: "Isabella — British Female" },

  { id: "bm_george", name: "George — British Male" },
  { id: "bm_lewis", name: "Lewis — British Male" }
];


/* =========================================================
   STATE
   ========================================================= */

let pages = [];
let currentPage = 0;

let kokoro = null;
let kokoroLoading = false;
let isSpeaking = false;
let stopRequested = false;

let currentAudio = null;
let currentAudioURL = null;


/* =========================================================
   ELEMENTS
   ========================================================= */

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

const previousWordBtn =
  document.getElementById("previousWordBtn");

const nextWordBtn =
  document.getElementById("nextWordBtn");

const clearBtn = document.getElementById("clearBtn");

const statusLine =
  document.getElementById("statusLine");

const ocrProgress =
  document.getElementById("ocrProgress");

const ocrPercent =
  document.getElementById("ocrPercent");


/* =========================================================
   STARTUP
   ========================================================= */

if (pageTotal) {
  pageTotal.textContent =
    String(MAX_PAGES).padStart(2, "0");
}

populateVoices();
updateDisplay();

if (rateSlider && rateValue) {
  rateValue.textContent =
    `${Number(rateSlider.value).toFixed(2)}x`;
}

setStatus("READY.");

console.log("PAGE READER ONLINE.");


/* =========================================================
   VOICE SELECTOR
   ========================================================= */

function populateVoices() {

  if (!voiceSelect) {
    return;
  }

  voiceSelect.innerHTML = "";

  KOKORO_VOICES.forEach((voice, index) => {

    const option =
      document.createElement("option");

    option.value = voice.id;
    option.textContent = voice.name;

    voiceSelect.appendChild(option);
  });

  voiceSelect.value = "af_heart";
}


/* =========================================================
   KOKORO INITIALIZATION
   ========================================================= */

async function loadKokoro() {

  if (kokoro) {
    return kokoro;
  }

  if (kokoroLoading) {

    while (kokoroLoading) {
      await sleep(250);
    }

    return kokoro;
  }

  kokoroLoading = true;

  try {

    setStatus("LOADING VOICE ENGINE...");

    updateSpeechProgress(0);

    const hasWebGPU =
      typeof navigator !== "undefined" &&
      "gpu" in navigator;

    const device =
      hasWebGPU
        ? "webgpu"
        : "wasm";

    const dtype =
      device === "webgpu"
        ? "fp32"
        : "q8";

    console.log(
      `KOKORO DEVICE: ${device}`
    );

    console.log(
      `KOKORO DTYPE: ${dtype}`
    );

    kokoro =
      await KokoroTTS.from_pretrained(
        KOKORO_MODEL,
        {
          dtype: dtype,
          device: device,

          progress_callback: progress => {

            if (
              progress &&
              typeof progress.progress === "number"
            ) {

              const percent =
                Math.round(
                  progress.progress
                );

              updateSpeechProgress(
                percent
              );

              setStatus(
                `LOADING VOICE ENGINE... ${percent}%`
              );
            }

          }
        }
      );

    updateSpeechProgress(100);

    setStatus(
      "VOICE ENGINE READY."
    );

    console.log("KOKORO READY.");

    return kokoro;

  }

  catch (error) {

    console.error(
      "KOKORO LOAD ERROR:",
      error
    );

    kokoro = null;

    setStatus(
      "VOICE ENGINE FAILED."
    );

    throw error;

  }

  finally {

    kokoroLoading = false;
  }
}


/* =========================================================
   SCAN BUTTON
   ========================================================= */

if (scanBtn && cameraInput) {

  scanBtn.addEventListener(
    "click",
    () => {

      cameraInput.click();

    }
  );


  cameraInput.addEventListener(
    "change",
    async event => {

      const file =
        event.target.files[0];

      if (!file) {
        return;
      }

      await scanPage(file);

      cameraInput.value = "";

    }
  );
}


/* =========================================================
   OCR
   ========================================================= */

async function scanPage(file) {

  if (pages.length >= MAX_PAGES) {

    setStatus(
      "INVENTORY FULL."
    );

    return;
  }

  setStatus(
    "SCANNING PAGE..."
  );

  setProgress(0);

  if (scanBtn) {
    scanBtn.disabled = true;
  }

  try {

    if (
      typeof Tesseract ===
      "undefined"
    ) {

      throw new Error(
        "TESSERACT NOT LOADED"
      );
    }

    const result =
      await Tesseract.recognize(
        file,
        "eng",
        {
          logger: message => {

            if (
              message.status ===
                "recognizing text" &&
              typeof message.progress ===
                "number"
            ) {

              const percent =
                Math.round(
                  message.progress * 100
                );

              setProgress(
                percent
              );

              setStatus(
                `READING PAGE... ${percent}%`
              );

            }
            else if (
              message.status
            ) {

              const label =
                message.status
                  .replace(
                    /_/g,
                    " "
                  )
                  .toUpperCase();

              setStatus(
                label + "..."
              );
            }
          }
        }
      );

    const text =
      result.data.text
        .replace(
          /\n{3,}/g,
          "\n\n"
        )
        .trim();

    if (!text) {

      setStatus(
        "NO TEXT FOUND."
      );

      return;
    }

    const imageURL =
      URL.createObjectURL(file);

    pages.push({
      text: text,
      image: imageURL
    });

    currentPage =
      pages.length - 1;

    setProgress(100);

    setStatus(
      "PAGE READ. QUEST UPDATED."
    );

    updateDisplay();

  }

  catch (error) {

    console.error(
      "OCR ERROR:",
      error
    );

    setStatus(
      "OCR FAILED."
    );

    if (textBuffer) {

      textBuffer.textContent =
        "THE PAGE COULD NOT BE READ.\n\n" +
        "TRY AGAIN WITH BETTER LIGHT.";
    }

  }

  finally {

    if (scanBtn) {
      scanBtn.disabled = false;
    }
  }
}


/* =========================================================
   DISPLAY
   ========================================================= */

function updateDisplay() {

  const number =
    pages.length === 0
      ? 0
      : currentPage + 1;

  if (pageCount) {

    pageCount.textContent =
      String(number)
        .padStart(2, "0");
  }

  if (pageTotal) {

    pageTotal.textContent =
      String(MAX_PAGES)
        .padStart(2, "0");
  }

  renderText();
  renderFilmstrip();
}


/* =========================================================
   TEXT DISPLAY
   ========================================================= */

function renderText() {

  if (!textBuffer) {
    return;
  }

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


/* =========================================================
   FILMSTRIP
   ========================================================= */

function renderFilmstrip() {

  if (!filmstrip) {
    return;
  }

  filmstrip.innerHTML = "";

  if (!pages.length) {

    if (filmstripEmpty) {
      filmstrip.appendChild(
        filmstripEmpty
      );
    }

    return;
  }

  pages.forEach(
    (page, index) => {

      const card =
        document.createElement(
          "div"
        );

      card.className =
        "page-card";

      if (
        index === currentPage
      ) {

        card.classList.add(
          "active"
        );
      }

      const img =
        document.createElement(
          "img"
        );

      img.src = page.image;

      img.alt =
        `Page ${index + 1}`;

      card.appendChild(img);

      card.addEventListener(
        "click",
        () => {

          stopSpeaking();

          currentPage =
            index;

          updateDisplay();

          setStatus(
            `PAGE ${String(
              index + 1
            ).padStart(
              2,
              "0"
            )} LOADED.`
          );
        }
      );

      filmstrip.appendChild(
        card
      );
    }
  );
}


/* =========================================================
   PLAY / STOP
   ========================================================= */

if (playBtn) {

  playBtn.addEventListener(
    "click",
    async () => {

      if (!pages.length) {

        setStatus(
          "SCAN A PAGE FIRST."
        );

        return;
      }

      if (isSpeaking) {

        stopSpeaking();

        return;
      }

      await readCurrentPage();

    }
  );
}


/* =========================================================
   READ CURRENT PAGE
   ========================================================= */

async function readCurrentPage() {

  if (!pages.length) {
    return;
  }

  stopRequested = false;

  isSpeaking = true;

  if (playBtn) {
    playBtn.textContent = "■";
  }

  try {

    const tts =
      await loadKokoro();

    if (stopRequested) {
      return;
    }

    const text =
      pages[currentPage].text;

    if (!text.trim()) {

      setStatus(
        "NO TEXT TO READ."
      );

      return;
    }

    const voice =
      voiceSelect?.value ||
      "af_heart";

    const speed =
      Number(
        rateSlider?.value || 1
      );

    const chunks =
      splitTextForSpeech(text);

    setStatus(
      "READING PAGE..."
    );

    console.log(
      "TTS CHUNKS:",
      chunks
    );

    for (
      let i = 0;
      i < chunks.length;
      i++
    ) {

      if (stopRequested) {
        break;
      }

      const chunk =
        chunks[i].trim();

      if (!chunk) {
        continue;
      }

      setStatus(
        `READING ${i + 1} OF ${chunks.length}...`
      );

      const audio =
        await tts.generate(
          chunk,
          {
            voice: voice,
            speed: speed
          }
        );

      if (stopRequested) {
        break;
      }

      await playKokoroAudio(
        audio
      );
    }

    if (!stopRequested) {

      setStatus(
        "PAGE COMPLETE."
      );
    }

  }

  catch (error) {

    console.error(
      "KOKORO SPEECH ERROR:",
      error
    );

    setStatus(
      "SPEECH ENGINE ERROR."
    );

  }

  finally {

    isSpeaking = false;

    if (playBtn) {
      playBtn.textContent = "▶";
    }
  }
}


/* =========================================================
   KOKORO AUDIO PLAYER
   ========================================================= */

async function playKokoroAudio(
  rawAudio
) {

  return new Promise(
    async (resolve, reject) => {

      try {

        cleanupAudio();

        const blob =
          rawAudio.toBlob();

        currentAudioURL =
          URL.createObjectURL(
            blob
          );

        currentAudio =
          new Audio(
            currentAudioURL
          );

        currentAudio.preload =
          "auto";

        currentAudio.onended =
          () => {

            cleanupAudio();

            resolve();

          };

        currentAudio.onerror =
          error => {

            cleanupAudio();

            reject(error);

          };

        await currentAudio.play();

      }

      catch (error) {

        cleanupAudio();

        reject(error);

      }
    }
  );
}


/* =========================================================
   STOP SPEAKING
   ========================================================= */

function stopSpeaking() {

  stopRequested = true;

  if (currentAudio) {

    currentAudio.pause();

    currentAudio.currentTime = 0;
  }

  cleanupAudio();

  isSpeaking = false;

  if (playBtn) {
    playBtn.textContent = "▶";
  }

  setStatus(
    "READY."
  );
}


/* =========================================================
   AUDIO CLEANUP
   ========================================================= */

function cleanupAudio() {

  if (currentAudio) {

    currentAudio.onended = null;
    currentAudio.onerror = null;

    currentAudio.pause();

    currentAudio = null;
  }

  if (currentAudioURL) {

    URL.revokeObjectURL(
      currentAudioURL
    );

    currentAudioURL = null;
  }
}


/* =========================================================
   TEXT CHUNKING
   ========================================================= */

function splitTextForSpeech(text) {

  const normalized =
    text
      .replace(
        /\s+/g,
        " "
      )
      .trim();

  if (!normalized) {
    return [];
  }

  /*
     Break at natural sentence boundaries.
     This helps Kokoro sound much more natural
     and prevents giant OCR pages from being
     treated as one enormous TTS request.
  */

  const sentences =
    normalized.match(
      /[^.!?]+[.!?]+|[^.!?]+$/g
    ) || [normalized];

  const chunks = [];

  let buffer = "";

  for (
    const sentence
    of sentences
  ) {

    const clean =
      sentence.trim();

    if (!clean) {
      continue;
    }

    if (
      (buffer + " " + clean)
        .length < 350
    ) {

      buffer =
        buffer
          ? `${buffer} ${clean}`
          : clean;

    }
    else {

      if (buffer) {
        chunks.push(buffer);
      }

      buffer = clean;
    }
  }

  if (buffer) {
    chunks.push(buffer);
  }

  return chunks;
}


/* =========================================================
   PAGE NAVIGATION
   ========================================================= */

if (prevBtn) {

  prevBtn.addEventListener(
    "click",
    () => {

      if (!pages.length) {

        setStatus(
          "NO PAGES."
        );

        return;
      }

      stopSpeaking();

      currentPage--;

      if (
        currentPage < 0
      ) {

        currentPage =
          pages.length - 1;
      }

      updateDisplay();

      setStatus(
        `PAGE ${
          currentPage + 1
        } LOADED.`
      );
    }
  );
}


if (nextBtn) {

  nextBtn.addEventListener(
    "click",
    () => {

      if (!pages.length) {

        setStatus(
          "NO PAGES."
        );

        return;
      }

      stopSpeaking();

      currentPage++;

      if (
        currentPage >=
        pages.length
      ) {

        currentPage = 0;
      }

      updateDisplay();

      setStatus(
        `PAGE ${
          currentPage + 1
        } LOADED.`
      );
    }
  );
}


/* =========================================================
   OLD WORD BUTTONS
   ========================================================= */

if (previousWordBtn) {

  previousWordBtn.addEventListener(
    "click",
    () => {

      setStatus(
        "PREVIOUS SECTION."
      );

    }
  );
}


if (nextWordBtn) {

  nextWordBtn.addEventListener(
    "click",
    () => {

      setStatus(
        "NEXT SECTION."
      );

    }
  );
}


/* =========================================================
   SPEED
   ========================================================= */

if (rateSlider) {

  rateSlider.addEventListener(
    "input",
    () => {

      const value =
        Number(
          rateSlider.value
        );

      if (rateValue) {

        rateValue.textContent =
          `${value.toFixed(2)}x`;
      }

      if (isSpeaking) {

        stopSpeaking();

        setStatus(
          "SPEED UPDATED."
        );
      }
    }
  );
}


/* =========================================================
   CLEAR
   ========================================================= */

if (clearBtn) {

  clearBtn.addEventListener(
    "click",
    () => {

      if (!pages.length) {

        setStatus(
          "INVENTORY ALREADY EMPTY."
        );

        return;
      }

      const confirmed =
        confirm(
          "CLEAR ALL PAGES?"
        );

      if (!confirmed) {
        return;
      }

      stopSpeaking();

      pages.forEach(
        page => {

          if (page.image) {

            URL.revokeObjectURL(
              page.image
            );
          }
        }
      );

      pages = [];

      currentPage = 0;

      setProgress(0);

      setStatus(
        "INVENTORY CLEARED."
      );

      updateDisplay();
    }
  );
}


/* =========================================================
   STATUS
   ========================================================= */

function setStatus(
  message
) {

  if (!statusLine) {
    return;
  }

  statusLine.textContent =
    message.toUpperCase();
}


/* =========================================================
   OCR PROGRESS
   ========================================================= */

function setProgress(
  value
) {

  const safeValue =
    Math.max(
      0,
      Math.min(
        100,
        value
      )
    );

  if (ocrProgress) {

    ocrProgress.style.width =
      `${safeValue}%`;
  }

  if (ocrPercent) {

    ocrPercent.textContent =
      `${safeValue}%`;
  }
}


/* =========================================================
   SPEECH ENGINE PROGRESS
   ========================================================= */

function updateSpeechProgress(
  value
) {

  /*
     Don't overwrite OCR progress.
     If your interface has a separate
     speech loading indicator, it can
     use this function later.
  */

  console.log(
    `VOICE ENGINE: ${value}%`
  );
}


/* =========================================================
   KEYBOARD CONTROLS
   ========================================================= */

document.addEventListener(
  "keydown",
  event => {

    if (
      event.code === "Space" &&
      document.activeElement?.tagName !==
        "INPUT" &&
      document.activeElement?.tagName !==
        "SELECT"
    ) {

      event.preventDefault();

      playBtn?.click();
    }

    if (
      event.code ===
      "ArrowLeft"
    ) {

      prevBtn?.click();
    }

    if (
      event.code ===
      "ArrowRight"
    ) {

      nextBtn?.click();
    }

    if (
      event.key.toLowerCase() ===
      "s"
    ) {

      scanBtn?.click();
    }
  }
);


/* =========================================================
   HELPERS
   ========================================================= */

function sleep(
  milliseconds
) {

  return new Promise(
    resolve =>
      setTimeout(
        resolve,
        milliseconds
      )
  );
}


/* =========================================================
   GLOBAL ERROR HANDLING
   ========================================================= */

window.addEventListener(
  "unhandledrejection",
  event => {

    console.error(
      "UNHANDLED ERROR:",
      event.reason
    );

  }
);
