import { Client } from "https://cdn.jsdelivr.net/npm/@gradio/client/dist/index.min.js";

const MAX_PAGES = 10;

let pages = [];
let currentPage = 0;
let isSpeaking = false;
let kokoro = null;
let kokoroReady = false;
let currentAudio = null;


/* -----------------------------
   ELEMENTS
----------------------------- */

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
   KOKORO VOICES
----------------------------- */

const KOKORO_VOICES = {

  "af_heart": "Heart — American Female",
  "af_bella": "Bella — American Female",
  "af_nicole": "Nicole — American Female",
  "af_aoede": "Aoede — American Female",
  "af_kore": "Kore — American Female",
  "af_sarah": "Sarah — American Female",
  "af_nova": "Nova — American Female",
  "af_sky": "Sky — American Female",
  "af_alloy": "Alloy — American Female",
  "af_jessica": "Jessica — American Female",
  "af_river": "River — American Female",

  "am_michael": "Michael — American Male",
  "am_fenrir": "Fenrir — American Male",
  "am_puck": "Puck — American Male",
  "am_echo": "Echo — American Male",
  "am_eric": "Eric — American Male",
  "am_liam": "Liam — American Male",
  "am_onyx": "Onyx — American Male",
  "am_adam": "Adam — American Male",

  "bf_emma": "Emma — British Female",
  "bf_isabella": "Isabella — British Female",
  "bf_alice": "Alice — British Female",
  "bf_lily": "Lily — British Female",

  "bm_george": "George — British Male",
  "bm_fable": "Fable — British Male",
  "bm_lewis": "Lewis — British Male",
  "bm_daniel": "Daniel — British Male"
};


function loadKokoroVoices() {

  voiceSelect.innerHTML = "";

  Object.entries(KOKORO_VOICES).forEach(
    ([value, label]) => {

      const option =
        document.createElement("option");

      option.value = value;
      option.textContent = label;

      voiceSelect.appendChild(option);
    }
  );

  voiceSelect.value = "af_heart";
}


/* -----------------------------
   STARTUP
----------------------------- */

pageTotal.textContent =
  String(MAX_PAGES).padStart(2, "0");

loadKokoroVoices();

updateDisplay();

initializeKokoro();


/* -----------------------------
   KOKORO CONNECTION
----------------------------- */

async function initializeKokoro() {

  try {

    setStatus("CONNECTING TO KOKORO...");

    kokoro =
      await Client.connect("hexgrad/Kokoro-TTS");

    kokoroReady = true;

    setStatus("KOKORO READY.");

  }

  catch (error) {

    console.error(
      "KOKORO CONNECTION ERROR:",
      error
    );

    kokoroReady = false;

    setStatus("KOKORO CONNECTION FAILED.");

  }
}


/* -----------------------------
   SCAN BUTTON
----------------------------- */

scanBtn.addEventListener("click", () => {

  cameraInput.click();

});


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

  scanBtn.textContent =
    "◆ SCANNING ◆";


  try {

    if (
      typeof Tesseract === "undefined"
    ) {

      throw new Error(
        "OCR ENGINE NOT LOADED"
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

              setProgress(percent);

              setStatus(
                `READING PAGE... ${percent}%`
              );

            }

            else if (
              message.status
            ) {

              const label =
                message.status
                  .replace(/_/g, " ")
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
        .replace(/\n{3,}/g, "\n\n")
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

    console.error(error);

    setStatus(
      "OCR FAILED."
    );


    textBuffer.textContent =
      "THE PAGE COULD NOT BE READ.\n\nTRY AGAIN WITH BETTER LIGHT.";

  }

  finally {

    scanBtn.disabled = false;

    scanBtn.textContent =
      "▲ SCAN PAGE";

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

    filmstrip.appendChild(
      filmstripEmpty
    );

    return;
  }


  pages.forEach(
    (page, index) => {

      const card =
        document.createElement("div");


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
        document.createElement("img");


      img.src =
        page.image;


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
            `PAGE ${String(index + 1).padStart(2, "0")} LOADED.`
          );

        }
      );


      filmstrip.appendChild(
        card
      );

    }
  );

}


/* -----------------------------
   PLAY / KOKORO SPEECH
----------------------------- */

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


    await speakCurrentPage();

  }
);


async function speakCurrentPage() {

  if (!kokoroReady) {

    setStatus(
      "KOKORO IS STILL LOADING..."
    );

    await initializeKokoro();

    if (!kokoroReady) {
      return;
    }

  }


  const text =
    pages[currentPage].text.trim();


  if (!text) {

    setStatus(
      "NO TEXT TO READ."
    );

    return;
  }


  stopSpeaking();


  isSpeaking = true;

  playBtn.textContent = "■";


  setStatus(
    "SUMMONING VOICE..."
  );


  try {

    const voice =
      voiceSelect.value ||
      "af_heart";


    const speed =
      Number(rateSlider.value) ||
      1;


    setStatus(
      "KOKORO IS READING..."
    );


    const result =
      await kokoro.predict(
        "/generate",
        [
          text,
          voice,
          speed,
          true
        ]
      );


    console.log(
      "KOKORO RESULT:",
      result
    );


    const audioData =
      result.data[0];


    if (!audioData) {

      throw new Error(
        "NO AUDIO RETURNED"
      );

    }


    let audioURL;


    if (
      typeof audioData ===
      "string"
    ) {

      audioURL =
        audioData;

    }

    else if (
      audioData.url
    ) {

      audioURL =
        audioData.url;

    }

    else if (
      audioData.path
    ) {

      audioURL =
        audioData.path;

    }

    else {

      throw new Error(
        "UNKNOWN AUDIO FORMAT"
      );

    }


    currentAudio =
      new Audio(audioURL);


    currentAudio.preload =
      "auto";


    currentAudio.onended =
      () => {

        isSpeaking = false;

        playBtn.textContent =
          "▶";

        setStatus(
          "PAGE COMPLETE."
        );

      };


    currentAudio.onerror =
      error => {

        console.error(
          "AUDIO ERROR:",
          error
        );

        isSpeaking = false;

        playBtn.textContent =
          "▶";

        setStatus(
          "AUDIO PLAYBACK ERROR."
        );

      };


    await currentAudio.play();


    setStatus(
      "READING PAGE..."
    );

  }

  catch (error) {

    console.error(
      "KOKORO ERROR:",
      error
    );


    isSpeaking = false;

    playBtn.textContent =
      "▶";


    setStatus(
      "KOKORO SPEECH FAILED."
    );

  }

}


/* -----------------------------
   STOP SPEAKING
----------------------------- */

function stopSpeaking() {

  if (currentAudio) {

    currentAudio.pause();

    currentAudio.currentTime =
      0;

    currentAudio.src = "";

    currentAudio = null;

  }


  isSpeaking = false;

  playBtn.textContent =
    "▶";

}


/* -----------------------------
   PAGE NAVIGATION
----------------------------- */

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


    if (currentPage < 0) {

      currentPage =
        pages.length - 1;

    }


    updateDisplay();


    setStatus(
      `PAGE ${currentPage + 1} LOADED.`
    );

  }
);


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
      currentPage >= pages.length
    ) {

      currentPage = 0;

    }


    updateDisplay();


    setStatus(
      `PAGE ${currentPage + 1} LOADED.`
    );

  }
);


/* -----------------------------
   SPEECH POSITION CONTROLS
----------------------------- */

previousWordBtn.addEventListener(
  "click",
  () => {

    if (!pages.length) {

      setStatus(
        "NO PAGES."
      );

      return;
    }


    stopSpeaking();

    setStatus(
      "RESTARTING PAGE."
    );

    speakCurrentPage();

  }
);


nextWordBtn.addEventListener(
  "click",
  () => {

    if (!pages.length) {

      setStatus(
        "NO PAGES."
      );

      return;
    }


    stopSpeaking();

    setStatus(
      "CONTINUING PAGE."
    );

    speakCurrentPage();

  }
);


/* -----------------------------
   SPEED
----------------------------- */

rateSlider.addEventListener(
  "input",
  () => {

    const value =
      Number(rateSlider.value);


    rateValue.textContent =
      `${value.toFixed(2)}x`;


    if (isSpeaking) {

      stopSpeaking();

      setStatus(
        "SPEED CHANGED."
      );

    }

  }
);


/* -----------------------------
   CLEAR
----------------------------- */

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


/* -----------------------------
   STATUS
----------------------------- */

function setStatus(message) {

  statusLine.textContent =
    message.toUpperCase();

}


function setProgress(value) {

  const safeValue =
    Math.max(
      0,
      Math.min(100, value)
    );


  ocrProgress.style.width =
    `${safeValue}%`;


  ocrPercent.textContent =
    `${safeValue}%`;

}


/* -----------------------------
   KEYBOARD CONTROLS
----------------------------- */

document.addEventListener(
  "keydown",
  event => {

    if (
      event.code ===
      "Space"
    ) {

      event.preventDefault();

      playBtn.click();

    }


    if (
      event.code ===
      "ArrowLeft"
    ) {

      prevBtn.click();

    }


    if (
      event.code ===
      "ArrowRight"
    ) {

      nextBtn.click();

    }


    if (
      event.key.toLowerCase() ===
      "s"
    ) {

      scanBtn.click();

    }

  }
);
