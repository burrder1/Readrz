const MAX_PAGES = 10;

let pages = [];
let currentPage = 0;
let voices = [];
let speaking = false;
let speechChunks = [];
let speechChunkIndex = 0;


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

const clearBtn = document.getElementById("clearBtn");

const statusLine = document.getElementById("statusLine");

const ocrProgress = document.getElementById("ocrProgress");
const ocrPercent = document.getElementById("ocrPercent");


/* =========================================================
   START
========================================================= */

pageTotal.textContent =
    String(MAX_PAGES).padStart(2, "0");

rateValue.textContent =
    Number(rateSlider.value).toFixed(2) + "x";

loadVoices();
updateDisplay();


/* =========================================================
   VOICES
========================================================= */

function loadVoices() {

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
       Prefer Samantha on Apple devices.
       Otherwise prefer an English US voice.
    */

    let preferred =
        voices.findIndex(voice =>
            /samantha/i.test(voice.name)
        );

    if (preferred === -1) {

        preferred =
            voices.findIndex(voice =>
                /^en-US$/i.test(voice.lang)
            );
    }

    if (preferred === -1) {

        preferred =
            voices.findIndex(voice =>
                /^en/i.test(voice.lang)
            );
    }

    if (preferred === -1) {
        preferred = 0;
    }

    voiceSelect.value =
        String(preferred);
}


if ("speechSynthesis" in window) {

    speechSynthesis.onvoiceschanged =
        loadVoices;
}


/* =========================================================
   CAMERA / FILE INPUT
========================================================= */

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

    stopSpeech();

    setStatus(
        "SCANNING PAGE..."
    );

    setProgress(0);

    scanBtn.disabled = true;

    try {

        if (
            typeof Tesseract ===
            "undefined"
        ) {

            throw new Error(
                "Tesseract is not loaded."
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
                                    message.progress *
                                    100
                                );

                            setProgress(
                                percent
                            );

                            setStatus(
                                `READING PAGE... ${percent}%`
                            );

                        } else if (
                            message.status
                        ) {

                            setStatus(
                                message.status
                                    .replace(
                                        /_/g,
                                        " "
                                    )
                                    .toUpperCase()
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


        const image =
            URL.createObjectURL(file);


        pages.push({
            text: text,
            image: image
        });


        currentPage =
            pages.length - 1;


        setProgress(100);

        setStatus(
            "PAGE READ."
        );

        updateDisplay();

    } catch (error) {

        console.error(
            "OCR ERROR:",
            error
        );

        setStatus(
            "OCR FAILED."
        );

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
        String(number).padStart(
            2,
            "0"
        );


    pageTotal.textContent =
        String(MAX_PAGES).padStart(
            2,
            "0"
        );


    renderText();
    renderFilmstrip();
}


/* =========================================================
   TEXT DISPLAY
========================================================= */

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
   PAGE FILMSTRIP
========================================================= */

function renderFilmstrip() {

    filmstrip.innerHTML = "";


    if (!pages.length) {

        if (filmstripEmpty) {

            filmstrip.appendChild(
                filmstripEmpty
            );

        } else {

            const empty =
                document.createElement(
                    "p"
                );

            empty.textContent =
                "NO PAGES COLLECTED.";

            filmstrip.appendChild(
                empty
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


            const image =
                document.createElement(
                    "img"
                );

            image.src =
                page.image;

            image.alt =
                `Page ${index + 1}`;


            card.appendChild(
                image
            );


            card.addEventListener(
                "click",
                () => {

                    stopSpeech();

                    currentPage =
                        index;

                    updateDisplay();

                    setStatus(
                        `PAGE ${
                            index + 1
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


/* =========================================================
   SPEECH
========================================================= */

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


        if (speaking) {

            stopSpeech();

            setStatus(
                "READING STOPPED."
            );

            return;
        }


        /*
           IMPORTANT:
           Start the FIRST utterance directly
           from the button click.

           This is much more reliable on iPhone.
        */

        startSpeech(
            pages[currentPage].text
        );
    }
);


/* =========================================================
   START SPEECH
========================================================= */

function startSpeech(text) {

    if (!text || !text.trim()) {

        setStatus(
            "NO TEXT TO READ."
        );

        return;
    }


    stopSpeech();


    speechChunks =
        splitText(text);


    speechChunkIndex = 0;

    speaking = true;

    playBtn.textContent =
        "■";


    setStatus(
        "READING PAGE..."
    );


    /*
       Speak immediately.
       Do NOT put the first speech call
       inside setTimeout.
    */

    speakCurrentChunk();
}


/* =========================================================
   SPEAK CHUNK
========================================================= */

function speakCurrentChunk() {

    if (!speaking) {
        return;
    }


    if (
        speechChunkIndex >=
        speechChunks.length
    ) {

        speaking = false;

        playBtn.textContent =
            "▶";

        setStatus(
            "PAGE COMPLETE."
        );

        return;
    }


    const utterance =
        new SpeechSynthesisUtterance(
            speechChunks[
                speechChunkIndex
            ]
        );


    /* VOICE */

    const selectedVoice =
        voices[
            Number(
                voiceSelect.value
            )
        ];


    if (selectedVoice) {

        utterance.voice =
            selectedVoice;

        utterance.lang =
            selectedVoice.lang;

    } else {

        utterance.lang =
            "en-US";
    }


    /* SPEED */

    utterance.rate =
        Number(
            rateSlider.value
        );


    /*
       Slightly softer pitch.
       Different voices will react differently.
    */

    utterance.pitch =
        0.95;


    utterance.volume =
        1;


    /* START */

    utterance.onstart = () => {

        speaking = true;

        playBtn.textContent =
            "■";
    };


    /* FINISH CHUNK */

    utterance.onend = () => {

        if (!speaking) {
            return;
        }


        speechChunkIndex++;


        /*
           Small pause between sentences.
        */

        setTimeout(
            () => {

                speakCurrentChunk();

            },
            100
        );
    };


    /* ERROR */

    utterance.onerror =
        event => {

            console.error(
                "Speech error:",
                event
            );


            if (
                event.error ===
                    "canceled" ||
                event.error ===
                    "interrupted"
            ) {

                return;
            }


            speaking = false;

            playBtn.textContent =
                "▶";


            setStatus(
                "SPEECH ERROR."
            );
        };


    /*
       ONLY cancel here if this isn't
       the first utterance.
    */

    if (
        speechChunkIndex > 0
    ) {

        speechSynthesis.cancel();
    }


    speechSynthesis.speak(
        utterance
    );
}


/* =========================================================
   SPLIT LONG TEXT
========================================================= */

function splitText(text) {

    /*
       Browser speech engines can choke on
       very long OCR text.

       Break it into sentence-sized chunks.
    */

    const sentences =
        text.match(
            /[^.!?]+[.!?]+|[^.!?]+$/g
        ) || [text];


    const chunks = [];

    let current = "";


    sentences.forEach(
        sentence => {

            const clean =
                sentence.trim();


            if (!clean) {
                return;
            }


            if (
                (
                    current +
                    " " +
                    clean
                ).length > 300
            ) {

                if (
                    current.trim()
                ) {

                    chunks.push(
                        current.trim()
                    );
                }


                current =
                    clean;

            } else {

                current +=
                    " " +
                    clean;
            }
        }
    );


    if (
        current.trim()
    ) {

        chunks.push(
            current.trim()
        );
    }


    return chunks;
}


/* =========================================================
   STOP SPEECH
========================================================= */

function stopSpeech() {

    speaking = false;

    speechChunks = [];

    speechChunkIndex = 0;


    if (
        "speechSynthesis" in window
    ) {

        speechSynthesis.cancel();
    }


    playBtn.textContent =
        "▶";
}


/* =========================================================
   PAGE NAVIGATION
========================================================= */

prevBtn.addEventListener(
    "click",
    () => {

        if (!pages.length) {

            setStatus(
                "NO PAGES."
            );

            return;
        }


        stopSpeech();


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


        stopSpeech();


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


/* =========================================================
   SPEED
========================================================= */

rateSlider.addEventListener(
    "input",
    () => {

        const value =
            Number(
                rateSlider.value
            );


        rateValue.textContent =
            value.toFixed(2) +
            "x";
    }
);


/* =========================================================
   VOICE CHANGE
========================================================= */

voiceSelect.addEventListener(
    "change",
    () => {

        if (!speaking) {
            return;
        }


        /*
           Stop current voice.
           User can press PLAY again
           with the new voice.
        */

        stopSpeech();

        setStatus(
            "VOICE CHANGED."
        );
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
                "INVENTORY EMPTY."
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


        stopSpeech();


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

        updateDisplay();


        setStatus(
            "INVENTORY CLEARED."
        );
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

    const safe =
        Math.max(
            0,
            Math.min(
                100,
                value
            )
        );


    if (ocrProgress) {

        ocrProgress.style.width =
            safe + "%";
    }


    if (ocrPercent) {

        ocrPercent.textContent =
            safe + "%";
    }
}


/* =========================================================
   KEYBOARD
========================================================= */

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
            event.key.toLowerCase()
            === "s"
        ) {

            scanBtn.click();
        }
    }
);
