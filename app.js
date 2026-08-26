const MAX_PAGES = 10;

let pages = [];
let currentPage = 0;
let voices = [];
let isSpeaking = false;
let speechQueue = [];
let speechIndex = 0;

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


/* =========================================================
   STARTUP
========================================================= */

pageTotal.textContent = String(MAX_PAGES).padStart(2, "0");

updateDisplay();

loadVoices();

if ("speechSynthesis" in window) {
    speechSynthesis.onvoiceschanged = loadVoices;
}


/* =========================================================
   VOICES
========================================================= */

function loadVoices() {

    if (!("speechSynthesis" in window)) {
        voiceSelect.innerHTML =
            "<option>Speech unavailable</option>";
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

    /*
       Prefer a natural English voice.
       Samantha is common on Apple devices.
    */

    let preferred = voices.findIndex(v =>
        /samantha/i.test(v.name)
    );

    if (preferred < 0) {
        preferred = voices.findIndex(v =>
            /en-US/i.test(v.lang)
        );
    }

    if (preferred < 0) {
        preferred = 0;
    }

    voiceSelect.value = preferred;
}


/* =========================================================
   SCAN
========================================================= */

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


/* =========================================================
   OCR
========================================================= */

async function scanPage(file) {

    if (pages.length >= MAX_PAGES) {

        setStatus("INVENTORY FULL.");

        return;
    }

    stopSpeaking();

    setStatus("SCANNING PAGE...");
    setProgress(0);

    scanBtn.disabled = true;

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
                            Math.round(
                                message.progress * 100
                            );

                        setProgress(percent);

                        setStatus(
                            `READING PAGE... ${percent}%`
                        );

                    } else if (message.status) {

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

    } catch (error) {

        console.error(error);

        setStatus("OCR FAILED.");

        if (textBuffer) {
            textBuffer.textContent =
                "THE PAGE COULD NOT BE READ.\n\nTRY AGAIN WITH BETTER LIGHT.";
        }

    } finally {

        scanBtn.disabled = false;
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


/* =========================================================
   FILMSTRIP
========================================================= */

function renderFilmstrip() {

    filmstrip.innerHTML = "";

    if (!pages.length) {

        if (filmstripEmpty) {
            filmstrip.appendChild(filmstripEmpty);
        }

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

        img.alt =
            `Page ${index + 1}`;

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


/* =========================================================
   SPEECH ENGINE
========================================================= */

playBtn.addEventListener("click", () => {

    /*
       IMPORTANT:
       This function is called directly from the
       user's button press. This is important on iPhone.
    */

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

        setStatus("READING STOPPED.");

        return;
    }

    startSpeaking(
        pages[currentPage].text
    );
});


function startSpeaking(text) {

    if (!text || !text.trim()) {

        setStatus("NO TEXT TO READ.");

        return;
    }

    stopSpeaking();

    /*
       Break long OCR text into smaller chunks.
       This is MUCH more reliable on iPhone/Safari.
    */

    speechQueue =
        splitTextIntoChunks(text);

    speechIndex = 0;

    if (!speechQueue.length) {

        setStatus("NO TEXT TO READ.");

        return;
    }

    isSpeaking = true;

    playBtn.textContent = "■";

    setStatus("READING PAGE...");

    speakNextChunk();
}


function speakNextChunk() {

    if (!isSpeaking) {
        return;
    }

    if (speechIndex >= speechQueue.length) {

        isSpeaking = false;

        playBtn.textContent = "▶";

        setStatus("PAGE COMPLETE.");

        return;
    }

    const chunk =
        speechQueue[speechIndex];

    const utterance =
        new SpeechSynthesisUtterance(chunk);


    /* -----------------------------
       VOICE
    ----------------------------- */

    const selectedIndex =
        Number(voiceSelect.value);

    const selectedVoice =
        voices[selectedIndex];

    if (selectedVoice) {

        utterance.voice =
            selectedVoice;

        utterance.lang =
            selectedVoice.lang;
    } else {

        utterance.lang = "en-US";
    }


    /* -----------------------------
       SPEED
    ----------------------------- */

    utterance.rate =
        Number(rateSlider.value);

    /*
       Slightly lower pitch sounds
       less robotic on many voices.
    */

    utterance.pitch = 0.95;

    utterance.volume = 1;


    /* -----------------------------
       EVENTS
    ----------------------------- */

    utterance.onstart = () => {

        isSpeaking = true;

        playBtn.textContent = "■";

    };


    utterance.onend = () => {

        if (!isSpeaking) {
            return;
        }

        speechIndex++;

        /*
           Small delay between chunks prevents
           Safari from randomly cutting speech off.
        */

        setTimeout(() => {

            speakNextChunk();

        }, 80);
    };


    utterance.onerror = event => {

        console.error(
            "Speech error:",
            event
        );

        /*
           Safari can occasionally throw "interrupted"
           when speechSynthesis changes state.
        */

        if (
            event.error === "interrupted" ||
            event.error === "canceled"
        ) {
            return;
        }

        isSpeaking = false;

        playBtn.textContent = "▶";

        setStatus(
            "SPEECH ERROR. TAP PLAY AGAIN."
        );
    };


    /*
       Make absolutely sure the speech engine
       isn't carrying an old utterance.
    */

    speechSynthesis.cancel();

    /*
       Give Safari a moment after cancel()
       before speaking the new utterance.
    */

    setTimeout(() => {

        if (isSpeaking) {

            speechSynthesis.speak(
                utterance
            );
        }

    }, 50);
}


/* =========================================================
   SPLIT TEXT
========================================================= */

function splitTextIntoChunks(text) {

    /*
       Split at sentences first.
    */

    const sentences =
        text.match(
            /[^.!?]+[.!?]+|[^.!?]+$/g
        ) || [text];

    const chunks = [];

    let current = "";

    sentences.forEach(sentence => {

        const cleaned =
            sentence.trim();

        if (!cleaned) {
            return;
        }

        /*
           Keep chunks around 350 characters.
           This is friendly to mobile speech engines.
        */

        if (
            (current + " " + cleaned).length
            > 350
        ) {

            if (current.trim()) {
                chunks.push(
                    current.trim()
                );
            }

            current = cleaned;

        } else {

            current +=
                " " + cleaned;
        }
    });

    if (current.trim()) {

        chunks.push(
            current.trim()
        );
    }

    return chunks;
}


/* =========================================================
   STOP SPEECH
========================================================= */

function stopSpeaking() {

    isSpeaking = false;

    speechQueue = [];

    speechIndex = 0;

    if ("speechSynthesis" in window) {

        speechSynthesis.cancel();
    }

    playBtn.textContent = "▶";
}


/* =========================================================
   PAGE NAVIGATION
========================================================= */

prevBtn.addEventListener("click", () => {

    if (!pages.length) {

        setStatus("NO PAGES.");

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
});


nextBtn.addEventListener("click", () => {

    if (!pages.length) {

        setStatus("NO PAGES.");

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
});


/* =========================================================
   PREVIOUS / NEXT SECTION
========================================================= */

if (previousWordBtn) {

    previousWordBtn.addEventListener(
        "click",
        () => {

            if (!pages.length) {

                setStatus("NO PAGES.");

                return;
            }

            stopSpeaking();

            setStatus("READING PAGE...");

            startSpeaking(
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

                setStatus("NO PAGES.");

                return;
            }

            stopSpeaking();

            setStatus("READING PAGE...");

            startSpeaking(
                pages[currentPage].text
            );
        }
    );
}


/* =========================================================
   SPEED
========================================================= */

rateSlider.addEventListener(
    "input",
    () => {

        const value =
            Number(rateSlider.value);

        rateValue.textContent =
            `${value.toFixed(2)}x`;

        if (isSpeaking) {

            /*
               Restart at the current chunk
               using the new speed.
            */

            speechSynthesis.cancel();

            setTimeout(() => {

                if (isSpeaking) {
                    speakNextChunk();
                }

            }, 50);
        }
    }
);


/* =========================================================
   VOICE CHANGE
========================================================= */

voiceSelect.addEventListener(
    "change",
    () => {

        if (isSpeaking) {

            speechSynthesis.cancel();

            setTimeout(() => {

                if (isSpeaking) {
                    speakNextChunk();
                }

            }, 50);
        }
    }
);


/* =========================================================
   CLEAR
========================================================= */

clearBtn.addEventListener(
    "click",
    () => {

        if (!pages.length) {

            setStatus(
                "INVENTORY ALREADY EMPTY."
            );

            return;
        }

        stopSpeaking();

        const confirmed =
            confirm(
                "CLEAR ALL PAGES?"
            );

        if (!confirmed) {
            return;
        }

        pages.forEach(page => {

            if (page.image) {

                URL.revokeObjectURL(
                    page.image
                );
            }
        });

        pages = [];

        currentPage = 0;

        setProgress(0);

        setStatus(
            "INVENTORY CLEARED."
        );

        updateDisplay();
    }
);


/* =========================================================
   STATUS
========================================================= */

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


/* =========================================================
   KEYBOARD
========================================================= */

document.addEventListener(
    "keydown",
    event => {

        if (
            event.code === "Space"
        ) {

            event.preventDefault();

            playBtn.click();
        }

        if (
            event.code === "ArrowLeft"
        ) {

            prevBtn.click();
        }

        if (
            event.code === "ArrowRight"
        ) {

            nextBtn.click();
        }

        if (
            event.key.toLowerCase()
            === "s"
        ) {

            scanBtn.click();
        }
    }
);


/* =========================================================
   MOBILE SPEECH UNLOCK
========================================================= */

/*
   Some mobile browsers need the speech engine
   awakened by a real user interaction.

   This tiny silent utterance does that.
*/

document.addEventListener(
    "touchstart",
    () => {

        if (
            "speechSynthesis" in window &&
            !window.__speechUnlocked
        ) {

            const unlock =
                new SpeechSynthesisUtterance("");

            unlock.volume = 0;

            speechSynthesis.speak(
                unlock
            );

            window.__speechUnlocked = true;
        }

    },
    {
        once: true,
        passive: true
    }
);
