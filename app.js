const MAX_PAGES = 10;

let pages = [];
let currentPage = 0;
let voices = [];
let isSpeaking = false;
let isPaused = false;
let currentUtterance = null;


/* =============================
   ELEMENTS
============================= */

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


/* =============================
   SPEECH ENGINE
============================= */

const speech =
  window.speechSynthesis || null;


/* =============================
   STARTUP
============================= */

pageTotal.textContent =
  String(MAX_PAGES).padStart(2, "0");

loadVoices();

if (speech) {

  speech.onvoiceschanged = () => {
    loadVoices();
  };

}

updateDisplay();


/* =============================
   LOAD VOICES
============================= */

function loadVoices() {

  if (!speech) {

    voiceSelect.innerHTML =
      "<option>Speech unavailable</option>";

    return;
  }

  const available =
    speech.getVoices();

  if (!available.length) {
    return;
  }

  voices = available;

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
     Prefer an English voice.
  */

  let preferred =
    voices.findIndex(voice =>
      /^en-US$/i.test(voice.lang)
    );


  if (preferred === -1) {

    preferred =
      voices.findIndex(voice =>
        /^en/i.test(voice.lang)
      );

  }


  if (preferred >= 0) {

    voiceSelect.value =
      String(preferred);

  }

}


/* =============================
   SCAN BUTTON
============================= */

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


/* =============================
   OCR
============================= */

async function scanPage(file) {

  if (pages.length >= MAX_PAGES) {

    setStatus("INVENTORY FULL.");

    return;
  }


  stopSpeaking();

  setStatus("SCANNING PAGE...");

  setProgress(0);

  scanBtn.disabled = true;

  scanBtn.textContent =
    "◆ SCANNING ◆";


  try {

    if (
      typeof Tesseract ===
      "undefined"
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

    console.error(
      "OCR ERROR:",
      error
    );


    setStatus(
      "OCR FAILED."
    );


    textBuffer.textContent =
      "THE PAGE COULD NOT BE READ.\n\n" +
      "TRY AGAIN WITH BETTER LIGHT.";

  }

  finally {

    scanBtn.disabled = false;

    scanBtn.textContent =
      "▲ SCAN PAGE";

  }

}


/* =============================
   DISPLAY
============================= */

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


/* =============================
   TEXT DISPLAY
============================= */

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


/* =============================
   FILMSTRIP
============================= */

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
            `PAGE ${
              String(index + 1)
                .padStart(2, "0")
            } LOADED.`
          );

        }
      );


      filmstrip.appendChild(
        card
      );

    }
  );

}


/* =============================
   PLAY BUTTON
============================= */

playBtn.addEventListener(
  "click",
  () => {

    if (!pages.length) {

      setStatus(
        "SCAN A PAGE FIRST."
      );

      return;
    }


    if (!speech) {

      setStatus(
        "SPEECH NOT SUPPORTED."
      );

      return;
    }


    /*
       If currently speaking,
       pressing the button pauses.
    */

    if (isSpeaking) {

      if (isPaused) {

        speech.resume();

        isPaused = false;

        playBtn.textContent =
          "■";

        setStatus(
          "READING PAGE..."
        );

      }

      else {

        speech.pause();

        isPaused = true;

        playBtn.textContent =
          "▶";

        setStatus(
          "PAUSED."
        );

      }

      return;
    }


    speakCurrentPage();

  }
);


/* =============================
   SPEAK CURRENT PAGE
============================= */

function speakCurrentPage() {

  const page =
    pages[currentPage];


  if (!page || !page.text) {

    setStatus(
      "NO TEXT TO READ."
    );

    return;
  }


  if (!speech) {

    setStatus(
      "SPEECH NOT SUPPORTED."
    );

    return;
  }


  /*
     IMPORTANT FOR SAFARI:
     Always cancel the previous
     utterance before starting.
  */

  speech.cancel();


  const text =
    page.text.trim();


  /*
     Very long OCR text can cause
     mobile browsers to choke.

     Split it into manageable chunks.
  */

  const chunks =
    splitTextIntoChunks(
      text,
      180
    );


  speakChunks(
    chunks,
    0
  );

}


/* =============================
   SPEAK CHUNKS
============================= */

function speakChunks(
  chunks,
  index
) {

  if (
    index >= chunks.length
  ) {

    isSpeaking = false;

    isPaused = false;

    currentUtterance = null;

    playBtn.textContent =
      "▶";

    setStatus(
      "PAGE COMPLETE."
    );

    return;
  }


  const utterance =
    new SpeechSynthesisUtterance(
      chunks[index]
    );


  /*
     Voice
  */

  const selectedIndex =
    Number(
      voiceSelect.value
    );


  const selectedVoice =
    voices[selectedIndex];


  if (selectedVoice) {

    utterance.voice =
      selectedVoice;

    utterance.lang =
      selectedVoice.lang;

  }


  /*
     Speed
  */

  utterance.rate =
    Number(
      rateSlider.value
    );


  utterance.pitch =
    1;


  utterance.volume =
    1;


  utterance.onstart = () => {

    isSpeaking = true;

    isPaused = false;

    playBtn.textContent =
      "■";

    setStatus(
      `READING ${
        index + 1
      }/${chunks.length}...`
    );

  };


  utterance.onend = () => {

    /*
       Give Safari a tiny breather
       between chunks.
    */

    setTimeout(
      () => {

        if (!isSpeaking) {
          return;
        }

        speakChunks(
          chunks,
          index + 1
        );

      },
      60
    );

  };


  utterance.onerror =
    event => {

      console.error(
        "Speech error:",
        event
      );


      isSpeaking = false;

      isPaused = false;

      currentUtterance =
        null;

      playBtn.textContent =
        "▶";


      setStatus(
        "SPEECH ERROR."
      );

    };


  currentUtterance =
    utterance;


  /*
     Safari occasionally needs
     speechSynthesis to be called
     after the button event.
  */

  speech.speak(
    utterance
  );

}


/* =============================
   TEXT CHUNKING
============================= */

function splitTextIntoChunks(
  text,
  maxLength
) {

  const sentences =
    text.match(
      /[^.!?]+[.!?]+|[^.!?]+$/g
    );


  if (!sentences) {
    return [text];
  }


  const chunks = [];

  let current = "";


  sentences.forEach(
    sentence => {

      const clean =
        sentence.trim();


      if (
        current.length +
          clean.length +
          1 >
        maxLength
      ) {

        if (current) {

          chunks.push(
            current.trim()
          );

        }

        current =
          clean;

      }

      else {

        current +=
          " " + clean;

      }

    }
  );


  if (current.trim()) {

    chunks.push(
      current.trim()
    );

  }


  return chunks;

}


/* =============================
   STOP SPEECH
============================= */

function stopSpeaking() {

  if (speech) {

    speech.cancel();

  }


  isSpeaking = false;

  isPaused = false;

  currentUtterance =
    null;


  playBtn.textContent =
    "▶";

}


/* =============================
   PAGE NAVIGATION
============================= */

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


/* =============================
   PREVIOUS / NEXT
============================= */

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
      "READING PAGE..."
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
      "READING PAGE..."
    );


    speakCurrentPage();

  }
);


/* =============================
   SPEED
============================= */

rateSlider.addEventListener(
  "input",
  () => {

    const value =
      Number(
        rateSlider.value
      );


    rateValue.textContent =
      `${value.toFixed(2)}x`;


    /*
       Don't kill speech while
       the slider is being moved.
       The new rate will apply
       the next time speech starts.
    */

    if (isSpeaking) {

      setStatus(
        `SPEED ${value.toFixed(2)}X`
      );

    }

  }
);


/* =============================
   CLEAR
============================= */

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
      window.confirm(
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


/* =============================
   STATUS
============================= */

function setStatus(message) {

  statusLine.textContent =
    String(message).toUpperCase();

}


function setProgress(value) {

  const safe =
    Math.max(
      0,
      Math.min(
        100,
        value
      )
    );


  ocrProgress.style.width =
    `${safe}%`;


  ocrPercent.textContent =
    `${safe}%`;

}


/* =============================
   KEYBOARD
============================= */

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
