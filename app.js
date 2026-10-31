import { HandLandmarker, FilesetResolver } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14";

const video = document.getElementById('cam');
const canvas = document.getElementById('pianoCanvas');
const ctx = canvas.getContext('2d');
const startBtn = document.getElementById('startAudioBtn');

//الصوت
let audioCtx = null;

function initAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
}

function playNote(freq) {
  if (!audioCtx) return;
  
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(freq, audioCtx.currentTime);

  gain.gain.setValueAtTime(0.25, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.6);

  osc.connect(gain);
  gain.connect(audioCtx.destination);

  osc.start();
  osc.stop(audioCtx.currentTime + 0.6);
}

startBtn.addEventListener('click', () => {
  initAudio();
  startBtn.innerText = " الصوت مشتغل حط اصبعك عالكاميرا";
  startBtn.style.background = "#2ecc71";
});

// 2. إعداد المفاتيح والترددات
const keys = [
  { name: 'C4', freq: 261.63, color: 'rgba(255, 99, 132, 0.5)', activeColor: '#ff6384' },
  { name: 'D4', freq: 293.66, color: 'rgba(54, 162, 235, 0.5)', activeColor: '#36a2eb' },
  { name: 'E4', freq: 329.63, color: 'rgba(255, 206, 86, 0.5)', activeColor: '#ffce56' },
  { name: 'F4', freq: 349.23, color: 'rgba(75, 192, 192, 0.5)', activeColor: '#4bc0c0' },
  { name: 'G4', freq: 392.00, color: 'rgba(153, 102, 255, 0.5)', activeColor: '#9966ff' },
  { name: 'A4', freq: 440.00, color: 'rgba(255, 159, 64, 0.5)', activeColor: '#ff9f40' },
  { name: 'B4', freq: 493.88, color: 'rgba(46, 204, 113, 0.5)', activeColor: '#2ecc71' }
  
];


const INDEX_FINGER_TIP = 8;
let prevTouchedKeys = new Set();


function renderScene(activeKeysSet, indexFingers) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const keyWidth = canvas.width / keys.length;
  const keyHeight = 130;

  // هاي هنا مفاتيح البيانو اخويه
  keys.forEach((key, index) => {
    const x = index * keyWidth;
    const isActive = activeKeysSet.has(index);

    ctx.fillStyle = isActive ? key.activeColor : key.color;
    ctx.fillRect(x, 0, keyWidth - 2, keyHeight);

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, 0, keyWidth - 2, keyHeight);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 18px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(key.name, x + keyWidth / 2, keyHeight - 15);
  });

  // هاي هنا الي يصير فوك السبابه
  indexFingers.forEach(finger => {
    ctx.beginPath();
    ctx.arc(finger.x, finger.y, 14, 0, 2 * Math.PI);
    ctx.fillStyle = finger.color;
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 13px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(finger.label, finger.x, finger.y - 20);
  });
}

// هاي هنا تشغل الكاميرااااا 
async function init() {
  try {
    const fileset = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
    );

    const hands = await HandLandmarker.createFromOptions(fileset, {
      baseOptions: {
        modelAssetPath: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
        delegate: "GPU"
      },
      runningMode: "VIDEO",
      numHands: 2
    });

    const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
    video.srcObject = stream;

    video.onloadeddata = () => {
      video.play();
      canvas.width = 640;
      canvas.height = 480;
      renderScene(new Set(), []);

      let lastVideoTime = -1;

      function loop() {
        if (video.currentTime !== lastVideoTime) {
          lastVideoTime = video.currentTime;

          const result = hands.detectForVideo(video, performance.now());
          const currentActiveKeys = new Set();
          const indexFingers = [];

          if (result.landmarks && result.landmarks.length > 0) {
            const keyWidth = canvas.width / keys.length;
            const keyHeight = 130;

            result.landmarks.forEach((lm, index) => {
              const handedness = result.handedness[index][0].categoryName;
              const isRightHand = handedness === 'Left'; 

              const indexTip = lm[INDEX_FINGER_TIP];
              const normX = 1 - indexTip.x;
              const normY = indexTip.y;

              const x = normX * canvas.width;
              const y = normY * canvas.height;

              indexFingers.push({
                x,
                y,
                label: isRightHand ? "سبابة يسار" : "سبابة يمين",
                color: isRightHand ? "#00d2ff" : "#ff007f"
              });

              if (y >= 0 && y <= keyHeight) {
                const keyIdx = Math.floor(x / keyWidth);
                if (keyIdx >= 0 && keyIdx < keys.length) {
                  currentActiveKeys.add(keyIdx);

                  if (!prevTouchedKeys.has(keyIdx)) {
                    playNote(keys[keyIdx].freq);
                  }
                }
              }
            });
          }

          prevTouchedKeys = currentActiveKeys;
          renderScene(currentActiveKeys, indexFingers);
        }

        requestAnimationFrame(loop);
      }

      loop();
    };

  } catch (err) {
    console.error("خطأ في تشغيل الكاميرا ", err);
  }
}

init();