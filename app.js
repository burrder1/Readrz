/* =========================================================
   PAGE READER
   OCR + TEXT TO SPEECH
   ========================================================= */

const MAX_PAGES = 10;

let pages = [];
let currentPage = 0;
let voices = [];
let isSpeaking = false;
let speechChunks = [];
let speechIndex = 0;


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

if (rateSlider && rateValue) {

  rateValue.textContent =
    `${Number(rateSlider.value).toFixed(2)}x`;
}

loadVoices();

if ("speechSynthesis" in window) {

  speechSynthesis.onvoiceschanged =
    loadVoices;
}

updateDisplay();


/* =========================================================
   VOICES
   ========================================================= */

function loadVoices() {

  if (!voiceSelect) {
    return;
  }

  if (!("speechSynthesis" in window)) {

    voiceSelect.innerHTML =
      "<option>Speech unavailable</option>";

    return;
  }

  voices =
    speechSynthesis.getVoices();

  if (!voices.length) {
    return;
  }

  voiceSelect.innerHTML = "";

  voices.forEach((voice, index) => {

    const option =
      document.createElement("option");

    option.value = index;

    option.textContent =
      `${voice.name} — ${voice.lang}`;

    voiceSelect.appendChild(option);
  });


  /*
     Prefer English voices.
     Samantha is especially nice on Apple devices
     when available.
  */

  let preferred =
    voices.findIndex(v =>
      /Samantha/i.test(v.name)
    );

  if (preferred < 0) {

    preferred =
      voices.findIndex(v =>
        /en-US/i.test(v.lang)
      );
  }

  if (preferred < 0) {

    preferred =
      voices.findIndex(v =>
        /^en/i.test(v.lang)
      );
  }

  if (preferred >= 0) {

    voiceSelect.value =
      preferred;
  }
}


/* =========================================================
   SCAN BUTTON
   ========================================================= */

if (scanBtn && cameraInput) {

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
}


/* =========================================================
   OCR
   ========================================================= */

async function scanPage(file) {

  if (pages.length >= MAX_PAGES) {

    setStatus("INVENTORY FULL.");

    return;
  }

  setStatus("SCANNING PAGE...");

  setProgress(0);

  if (scanBtn) {

    scanBtn.disabled = true;

    scanBtn.textContent =
      "◆ SCANNING ◆";
  }

  try {

    if (typeof Tesseract === "undefined") {

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

            else if (message.status) {

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
        .replace(/\r/g, "")
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


    if (textBuffer) {

      textBuffer.textContent =
        "THE PAGE COULD NOT BE READ.\n\n" +
        "TRY AGAIN WITH BETTER LIGHT.";
    }

  }

  finally {

    if (scanBtn) {

      scanBtn.disabled = false;

      scanBtn.textContent =
        "▲ SCAN PAGE";
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
      String(number).padStart(2, "0");
  }


  if (pageTotal) {

    pageTotal.textContent =
      String(MAX_PAGES).padStart(2, "0");
  }


  renderText();

  renderFilmstrip();
}


/* =========================================================
   TEXT BUFFER
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
        document.createElement("div");


      card.className =
        "page-card";


      if (index === currentPage) {

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
            `PAGE ${String(
              index + 1
            ).padStart(2, "0")} LOADED.`
          );

        }
      );


      filmstrip.appendChild(card);

    }
  );
}


/* =========================================================
   PLAY / SPEECH
   ========================================================= */

if (playBtn) {

  playBtn.addEventListener(
    "click",
    () => {

      if (!pages.length) {

        setStatus(
          "SCAN A PAGE FIRST."
        );

        return;
      }


      if (
        !("speechSynthesis" in window)
      ) {

        setStatus(
          "SPEECH NOT SUPPORTED."
        );

        return;
      }


      if (isSpeaking) {

        stopSpeaking();

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


      speakText(text);

    }
  );
}


/* =========================================================
   NATURALER SPEECH ENGINE
   ========================================================= */

function speakText(text) {

  if (
    !("speechSynthesis" in window)
  ) {

    setStatus(
      "SPEECH NOT SUPPORTED."
    );

    return;
  }


  speechSynthesis.cancel();


  /*
     Break OCR into smaller natural chunks.

     This is much better than sending one giant
     block of OCR text to the browser voice.
  */

  speechChunks =
    text
      .replace(/\r/g, "")
      .split(
        /\n{2,}|(?<=[.!?])\s+/
      )
      .map(
        chunk => chunk.trim()
      )
      .filter(
        chunk => chunk.length > 0
      );


  if (!speechChunks.length) {
    return;
  }


  speechIndex = 0;

  isSpeaking = true;


  if (playBtn) {

    playBtn.textContent =
      "■";
  }


  setStatus(
    "READING PAGE..."
  );


  speakNextChunk();
}


/* =========================================================
   SPEAK NEXT CHUNK
   ========================================================= */

function speakNextChunk() {

  if (
    !isSpeaking ||
    speechIndex >= speechChunks.length
  ) {

    isSpeaking = false;

    if (playBtn) {

      playBtn.textContent =
        "▶";
    }

    setStatus(
      "PAGE COMPLETE."
    );

    return;
  }


  const text =
    speechChunks[speechIndex];


  const utterance =
    new SpeechSynthesisUtterance(
      text
    );


  /*
     SELECTED VOICE
  */

  const selectedVoice =
    voiceSelect
      ? voices[voiceSelect.value]
      : null;


  if (selectedVoice) {

    utterance.voice =
      selectedVoice;
  }


  /*
     SPEED

     Slightly below the raw slider value
     makes speech sound less rushed.
  */

  const baseRate =
    rateSlider
      ? Number(rateSlider.value)
      : 1;


  utterance.rate =
    Math.max(
      0.75,
      Math.min(
        1.5,
        baseRate * 0.96
      )
    );


  /*
     PITCH

     Tiny variations keep the voice from
     sounding completely flat.
  */

  const pitchPattern = [

    1.02,
    1.06,
    0.99,
    1.04,
    1.00,
    1.07

  ];


  utterance.pitch =
    pitchPattern[
      speechIndex %
      pitchPattern.length
    ];


  utterance.volume = 1;


  utterance.onstart = () => {

    isSpeaking = true;

    if (playBtn) {

      playBtn.textContent =
        "■";
    }

  };


  utterance.onend = () => {

    speechIndex++;


    /*
       Tiny pause between sentences.
       Gives the narration some breathing room.
    */

    const pause =
      /[.!?]$/.test(text)
        ? 180
        : 80;


    setTimeout(
      () => {

        if (isSpeaking) {

          speakNextChunk();

        }

      },
      pause
    );

  };


  utterance.onerror =
    error => {

      console.error(
        "Speech error:",
        error
      );


      isSpeaking = false;


      if (playBtn) {

        playBtn.textContent =
          "▶";
      }


      setStatus(
        "SPEECH ERROR."
      );
    };


  speechSynthesis.speak(
    utterance
  );
}


/* =========================================================
   STOP SPEAKING
   ========================================================= */

function stopSpeaking() {

  if (
    "speechSynthesis" in window
  ) {

    speechSynthesis.cancel();
  }


  isSpeaking = false;

  speechChunks = [];

  speechIndex = 0;


  if (playBtn) {

    playBtn.textContent =
      "▶";
  }


  setStatus(
    "READY."
  );
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


      if (currentPage < 0) {

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
   PREVIOUS / NEXT SPEECH CONTROLS
   ========================================================= */

if (previousWordBtn) {

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


      speakText(
        pages[currentPage].text
      );

    }
  );
}


if (nextWordBtn) {

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


      speakText(
        pages[currentPage].text
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


      /*
         Don't abruptly kill speech while
         the user is moving the slider.
      */

    }
  );
}


/* =========================================================
   VOICE CHANGE
   ========================================================= */

if (voiceSelect) {

  voiceSelect.addEventListener(
    "change",
    () => {

      if (isSpeaking) {

        stopSpeaking();

        setStatus(
          "VOICE CHANGED. PRESS PLAY."
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

function setStatus(message) {

  if (!statusLine) {
    return;
  }


  statusLine.textContent =
    message.toUpperCase();
}


/* =========================================================
   OCR PROGRESS
   ========================================================= */

function setProgress(value) {

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
   KEYBOARD CONTROLS
   ========================================================= */

document.addEventListener(
  "keydown",
  event => {

    /*
       SPACE = PLAY / STOP
    */

    if (
      event.code === "Space"
    ) {

      event.preventDefault();

      if (playBtn) {

        playBtn.click();
      }
    }


    /*
       LEFT = PREVIOUS PAGE
    */

    if (
      event.code === "ArrowLeft"
    ) {

      if (prevBtn) {

        prevBtn.click();
      }
    }


    /*
       RIGHT = NEXT PAGE
    */

    if (
      event.code === "ArrowRight"
    ) {

      if (nextBtn) {

        nextBtn.click();
      }
    }


    /*
       S = SCAN
    */

    if (
      event.key.toLowerCase() === "s"
    ) {

      if (scanBtn) {

        scanBtn.click();
      }
    }

  }
);
