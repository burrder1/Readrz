/* =========================================
   PAGE READER
   OCR + TEXT TO SPEECH
   ========================================= */

const synth = window.speechSynthesis;


/* =========================================
   APP STATE
   ========================================= */

let pages = [];
let currentPage = 0;
let voices = [];
let speaking = false;
let worker = null;


/* =========================================
   ELEMENTS
   ========================================= */

const filmstrip = document.getElementById("filmstrip");

const pageCount = document.getElementById("pageCount");
const pageTotal = document.getElementById("pageTotal");

const voiceSelect = document.getElementById("voiceSelect");

const rateSlider = document.getElementById("rateSlider");
const rateValue = document.getElementById("rateValue");

const statusLine = document.getElementById("statusLine");
const scanStatus = document.getElementById("scanStatus");

const cameraInput = document.getElementById("cameraInput");

const scanBtn = document.getElementById("scanBtn");

const prevBtn = document.getElementById("prevBtn");
const backBtn = document.getElementById("backBtn");

const playBtn = document.getElementById("playBtn");

const nextBtn = document.getElementById("nextBtn");
const nextPageBtn = document.getElementById("nextPageBtn");

const clearBtn = document.getElementById("clearBtn");

const progressFill = document.getElementById("progressFill");
const progressText = document.getElementById("progressText");


/* =========================================
   INITIALIZE
   ========================================= */

function init() {

  pageTotal.textContent = "10";

  updatePageCounter();

  loadVoices();

  if ("onvoiceschanged" in synth) {
    synth.onvoiceschanged = loadVoices;
  }

  updateStatus("READY.");

  rateSlider.addEventListener("input", updateRate);

  scanBtn.addEventListener("click", openCamera);

  cameraInput.addEventListener("change", handleImage);

  playBtn.addEventListener("click", toggleSpeech);

  prevBtn.addEventListener("click", previousPage);

  backBtn.addEventListener("click", previousPage);

  nextBtn.addEventListener("click", nextPage);

  nextPageBtn.addEventListener("click", nextPage);

  clearBtn.addEventListener("click", clearPages);
}


/* =========================================
   STATUS
   ========================================= */

function updateStatus(message) {

  statusLine.textContent = message;

  scanStatus.textContent = message
    .toUpperCase()
    .substring(0, 18);
}


/* =========================================
   VOICES
   ========================================= */

function loadVoices() {

  voices = synth.getVoices();

  voiceSelect.innerHTML = "";

  if (!voices.length) {

    const option = document.createElement("option");

    option.textContent = "DEFAULT";

    option.value = "";

    voiceSelect.appendChild(option);

    return;
  }


  voices.forEach((voice, index) => {

    const option = document.createElement("option");

    option.value = index;

    option.textContent =
      `${voice.name} (${voice.lang})`;

    voiceSelect.appendChild(option);

  });
}


/* =========================================
   SPEED
   ========================================= */

function updateRate() {

  const rate = Number(rateSlider.value);

  rateValue.textContent =
    `${rate.toFixed(2)}x`;
}


/* =========================================
   CAMERA
   ========================================= */

function openCamera() {

  cameraInput.value = "";

  cameraInput.click();
}


/* =========================================
   IMAGE PROCESSING
   ========================================= */

async function handleImage(event) {

  const file = event.target.files[0];

  if (!file) {
    return;
  }


  if (pages.length >= 10) {

    updateStatus("PAGE LIMIT REACHED.");

    return;
  }


  try {

    updateStatus("LOADING IMAGE...");

    setProgress(5);


    const imageURL =
      URL.createObjectURL(file);


    /*
      Make sure Tesseract exists.
    */

    if (!window.Tesseract) {

      throw new Error(
        "Tesseract OCR failed to load."
      );

    }


    updateStatus("STARTING OCR...");


    /*
      Create OCR worker.
    */

    worker = await Tesseract.createWorker(
      "eng",
      1,
      {
        logger: message => {

          if (message.status === "recognizing text") {

            const progress =
              Math.round(message.progress * 100);

            setProgress(progress);

            updateStatus(
              `SCANNING ${progress}%`
            );
          }

        }
      }
    );


    /*
      Perform OCR.
    */

    const result =
      await worker.recognize(imageURL);


    const text =
      result.data.text.trim();


    await worker.terminate();

    worker = null;

    URL.revokeObjectURL(imageURL);


    if (!text) {

      updateStatus(
        "NO TEXT FOUND."
      );

      setProgress(0);

      return;
    }


    /*
      Save page.
    */

    pages.push({
      text: text,
      image: imageURL
    });


    currentPage =
      pages.length - 1;


    updatePageCounter();

    displayCurrentPage();

    setProgress(100);

    updateStatus(
      "SCAN COMPLETE."
    );


    /*
      Reset progress after a moment.
    */

    setTimeout(() => {

      setProgress(0);

    }, 1200);


  } catch (error) {

    console.error(error);

    if (worker) {

      try {
        await worker.terminate();
      } catch {}
    }

    worker = null;

    updateStatus(
      "OCR ERROR."
    );

    setProgress(0);

  }

}


/* =========================================
   DISPLAY PAGE
   ========================================= */

function displayCurrentPage() {

  if (!pages.length) {

    filmstrip.innerHTML = `
      <div class="placeholder">
        READY_
      </div>
    `;

    return;
  }


  const page =
    pages[currentPage];


  filmstrip.textContent =
    page.text;


  /*
    Add a cursor-like ending.
  */

  filmstrip.scrollTop = 0;
}


/* =========================================
   PAGE COUNTER
   ========================================= */

function updatePageCounter() {

  pageCount.textContent =
    String(pages.length).padStart(2, "0");

  pageTotal.textContent =
    "10";
}


/* =========================================
   SPEECH
   ========================================= */

function toggleSpeech() {

  if (!pages.length) {

    updateStatus(
      "SCAN A PAGE FIRST."
    );

    return;
  }


  if (speaking) {

    synth.cancel();

    speaking = false;

    playBtn.textContent = "▶";

    updateStatus("PAUSED.");

    return;
  }


  speakCurrentPage();
}


/* =========================================
   READ CURRENT PAGE
   ========================================= */

function speakCurrentPage() {

  const page =
    pages[currentPage];


  if (!page || !page.text) {

    updateStatus(
      "NO TEXT TO READ."
    );

    return;
  }


  synth.cancel();


  const utterance =
    new SpeechSynthesisUtterance(
      page.text
    );


  /*
    Voice
  */

  const voiceIndex =
    Number(voiceSelect.value);


  if (
    !Number.isNaN(voiceIndex) &&
    voices[voiceIndex]
  ) {

    utterance.voice =
      voices[voiceIndex];

    utterance.lang =
      voices[voiceIndex].lang;
  }


  /*
    Speed
  */

  utterance.rate =
    Number(rateSlider.value);


  /*
    Events
  */

  utterance.onstart = () => {

    speaking = true;

    playBtn.textContent = "■";

    updateStatus("READING...");
  };


  utterance.onend = () => {

    speaking = false;

    playBtn.textContent = "▶";

    updateStatus("DONE.");
  };


  utterance.onerror = () => {

    speaking = false;

    playBtn.textContent = "▶";

    updateStatus(
      "SPEECH ERROR."
    );
  };


  synth.speak(utterance);
}


/* =========================================
   PREVIOUS PAGE
   ========================================= */

function previousPage() {

  if (!pages.length) {
    return;
  }


  if (currentPage > 0) {

    synth.cancel();

    speaking = false;

    playBtn.textContent = "▶";

    currentPage--;

    displayCurrentPage();

    updateStatus(
      `PAGE ${currentPage + 1}`
    );
  }
}


/* =========================================
   NEXT PAGE
   ========================================= */

function nextPage() {

  if (!pages.length) {
    return;
  }


  if (currentPage < pages.length - 1) {

    synth.cancel();

    speaking = false;

    playBtn.textContent = "▶";

    currentPage++;

    displayCurrentPage();

    updateStatus(
      `PAGE ${currentPage + 1}`
    );
  }
}


/* =========================================
   CLEAR
   ========================================= */

function clearPages() {

  synth.cancel();

  speaking = false;

  pages = [];

  currentPage = 0;

  playBtn.textContent = "▶";

  updatePageCounter();

  displayCurrentPage();

  updateStatus("CLEARED.");

  setProgress(0);
}


/* =========================================
   OCR PROGRESS
   ========================================= */

function setProgress(value) {

  const safeValue =
    Math.max(
      0,
      Math.min(100, value)
    );


  progressFill.style.width =
    `${safeValue}%`;


  progressText.textContent =
    `${Math.round(safeValue)}%`;
}


/* =========================================
   START
   ========================================= */

init();
