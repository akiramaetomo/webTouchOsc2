(function() {

    // === 初期設定 ===

    // DOM要素の取得
    const synthArea = document.getElementById('synthArea');
    const waveformSelect = document.getElementById('waveform');
    const attackSlider = document.getElementById('attackSlider');
    const releaseSlider = document.getElementById('releaseSlider');
    const delayToggle = document.getElementById('delayToggle');
    const delayTimeSlider = document.getElementById('delayTime');
    const feedbackSlider = document.getElementById('feedback');
    const debugLog = document.getElementById('debugLog');

    // ラベル表示用の要素
    let infoDisplay = null;

    // オーディオコンテキストとノードの設定
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const masterGain = audioCtx.createGain();
    masterGain.connect(audioCtx.destination);

    const delayNode = audioCtx.createDelay(5.0); // 最大5秒
    delayNode.delayTime.value = parseFloat(delayTimeSlider.value);

    const feedbackGain = audioCtx.createGain();
    feedbackGain.gain.value = parseFloat(feedbackSlider.value);

    // ボイス管理
    const activeVoices = {}; 
    const voiceOrder = [];   
    const pointers = {}; 
    const baseVolume = 0.1;
    let MAX_POLYPHONY = 2; // デフォルト値

    // 周波数の下限と上限
    let minFrequency = 27.5; // デフォルト下限
    let maxFrequency = 7040; // デフォルト上限

    // === 設定適用関連 ===

    function applySettings() {
        const showInfo = localStorage.getItem("showInfo") === "true";
        const polyphony = parseInt(localStorage.getItem("polyphony") || "2", 10);
        MAX_POLYPHONY = Math.min(Math.max(polyphony, 1), 8);

        // 周波数の設定
        const savedMin = parseFloat(localStorage.getItem('minFrequency'));
        const savedMax = parseFloat(localStorage.getItem('maxFrequency'));

        if (savedMin && savedMax && savedMin < savedMax) {
            minFrequency = savedMin;
            maxFrequency = savedMax;
        } else {
            // デフォルト値にリセット
            minFrequency = 27.5;
            maxFrequency = 7040;
            localStorage.setItem('minFrequency', minFrequency);
            localStorage.setItem('maxFrequency', maxFrequency);
        }

        // ラベル表示の設定
        if (showInfo && !infoDisplay) {
            createInfoDisplay();
        } else if (!showInfo && infoDisplay) {
            removeInfoDisplay();
        }
    }

    function createInfoDisplay() {
        infoDisplay = document.createElement("div");
        infoDisplay.id = "infoDisplay";
        Object.assign(infoDisplay.style, {
            position: "absolute",
            backgroundColor: "rgba(255, 255, 255, 0.8)",
            padding: "5px",
            borderRadius: "5px",
            pointerEvents: "none",
            display: "none"
        });
        document.body.appendChild(infoDisplay);
    }

    function removeInfoDisplay() {
        infoDisplay.remove();
        infoDisplay = null;
    }

    // イベントリスナーの登録
    document.addEventListener("DOMContentLoaded", applySettings);
    window.addEventListener("pageshow", applySettings);

    // === UI更新関連 ===

    function initializeUI() {
        // スライダーの初期値表示
        const attackDisplay = createDisplay(`Attack Time: ${attackSlider.value}s`);
        const releaseDisplay = createDisplay(`Release Time: ${releaseSlider.value}s`);
        debugLog.appendChild(attackDisplay);
        debugLog.appendChild(releaseDisplay);

        // スライダーのリアルタイム表示更新
        attackSlider.addEventListener('input', () => {
            attackDisplay.textContent = `Attack Time: ${attackSlider.value}s`;
        });

        releaseSlider.addEventListener('input', () => {
            releaseDisplay.textContent = `Release Time: ${releaseSlider.value}s`;
        });

        // ディレイエフェクトの表示設定
        const delayDisplayTime = createDisplay(`Delay Time: ${delayTimeSlider.value}s`);
        const delayDisplayFeedback = createDisplay(`Feedback: ${(feedbackSlider.value * 100).toFixed(2)}%`);
        debugLog.appendChild(delayDisplayTime);
        debugLog.appendChild(delayDisplayFeedback);

        // ディレイスライダーのイベント設定
        delayTimeSlider.addEventListener('input', () => {
            delayDisplayTime.textContent = `Delay Time: ${delayTimeSlider.value}s`;
            if (delayNode) {
                delayNode.delayTime.setValueAtTime(parseFloat(delayTimeSlider.value), audioCtx.currentTime);
            }
        });

        feedbackSlider.addEventListener('input', () => {
            delayDisplayFeedback.textContent = `Feedback: ${(feedbackSlider.value * 100).toFixed(2)}%`;
            if (feedbackGain) {
                feedbackGain.gain.setValueAtTime(parseFloat(feedbackSlider.value), audioCtx.currentTime);
            }
        });

        // ディレイトoggleの設定
        delayToggle.addEventListener('change', toggleDelayEffect);
    }

    function createDisplay(text) {
        const display = document.createElement('div');
        display.textContent = text;
        return display;
    }

    // === ディレイエフェクト関連 ===

    function enableDelay() {
        masterGain.disconnect();
        masterGain.connect(delayNode);
        delayNode.connect(audioCtx.destination);
        delayNode.connect(feedbackGain);
        feedbackGain.connect(delayNode);
        createDebugEntry('Delay effect enabled');
    }

    function disableDelay() {
        masterGain.disconnect();
        masterGain.connect(audioCtx.destination);
        delayNode.disconnect();
        feedbackGain.disconnect();
        createDebugEntry('Delay effect disabled');
    }

    function toggleDelayEffect() {
        if (delayToggle.checked) {
            enableDelay();
        } else {
            disableDelay();
        }
    }

    // === ポインター関連 ===

    function createPointer(id, className) {
        const pointer = document.createElement('div');
        pointer.classList.add('pointer', className);
        pointer.id = id;
        synthArea.appendChild(pointer);
        return pointer;
    }

    function movePointer(pointer, x, y) {
        pointer.style.left = `${x}px`;
        pointer.style.top = `${y}px`;
    }

    // === ラベル表示関連 ===

    synthArea.addEventListener("pointerdown", handlePointerDown);
    synthArea.addEventListener("pointermove", handlePointerMove);
    synthArea.addEventListener("pointerup", handlePointerUp);
    synthArea.addEventListener("pointercancel", handlePointerCancel);

    function handlePointerDown(event) {
        if (infoDisplay) {
            infoDisplay.style.display = "block";
        }

        event.preventDefault();
        const { x, y } = getRelativePosition(event);
        const frequency = calculateFrequency(y);
        const volume = calculateVolume(x);

        startOscillator(event, frequency, volume);
        createAndActivatePointer(event, x, y);
    }

    function handlePointerMove(event) {
        if (infoDisplay) {
            updateLabelPosition(event);
        }

        if (activeVoices[event.pointerId] && activeVoices[event.pointerId].state === 'active') {
            const { x, y } = getRelativePosition(event);
            const frequency = calculateFrequency(y);
            const volume = calculateVolume(x);
            updateVoice(event.pointerId, frequency, volume);
            movePointerOptimized(event.pointerId, x, y);
        }
    }

    function handlePointerUp(event) {
        if (infoDisplay) {
            infoDisplay.style.display = "none";
        }
        stopOscillator(event.pointerId);
        removePointer(event.pointerId);
    }

    function handlePointerCancel(event) {
        if (infoDisplay) {
            infoDisplay.style.display = "none";
        }
        stopOscillator(event.pointerId);
        removePointer(event.pointerId);
    }

    function getRelativePosition(event) {
        const rect = synthArea.getBoundingClientRect();
        return {
            x: event.clientX - rect.left,
            y: event.clientY - rect.top
        };
    }

    function updateLabelPosition(event) {
        const { x, y } = getRelativePosition(event);
        const frequency = calculateFrequency(y);
        const volume = calculateVolume(x);
        const volumeDb = 20 * Math.log10(volume); // dB変換

        Object.assign(infoDisplay.style, {
            left: `${event.clientX + 15}px`,
            top: `${event.clientY}px`
        });
        infoDisplay.innerHTML = `Frequency: ${frequency.toFixed(1)} Hz<br>Volume: ${volumeDb.toFixed(1)} dB`;
    }

    function createAndActivatePointer(event, x, y) {
        const pointerId = event.pointerId;
        if (!pointers[pointerId]) {
            const className = Object.keys(pointers).length === 0 ? 'pointer1' : 'pointer2';
            pointers[pointerId] = createPointer(`pointer${pointerId}`, className);
        }
        movePointer(pointers[pointerId], x, y);
        pointers[pointerId].classList.add('active');
    }

    function removePointer(pointerId) {
        if (pointers[pointerId]) {
            synthArea.removeChild(pointers[pointerId]);
            delete pointers[pointerId];
        }
    }

    function movePointerOptimized(pointerId, x, y) {
        requestAnimationFrame(() => {
            movePointer(pointers[pointerId], x, y);
        });
    }

    // === オシレーター管理関連 ===

    function startOscillator(event, frequency, volume) {
        const pointerId = event.pointerId;

        // ポリフォニー制限の確認
        if (voiceOrder.length >= MAX_POLYPHONY) {
            handlePolyphonyLimit();
        }

        try {
            resumeAudioContext();

            // オシレーターとゲインノードの作成
            const oscillator = audioCtx.createOscillator();
            const gainNode = audioCtx.createGain();
            const attackTime = parseFloat(attackSlider.value);

            oscillator.type = waveformSelect.value;
            oscillator.frequency.setValueAtTime(frequency, audioCtx.currentTime);

            gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
            gainNode.gain.linearRampToValueAtTime(volume, audioCtx.currentTime + attackTime);

            oscillator.connect(gainNode);
            gainNode.connect(masterGain);

            oscillator.start();

            // ボイス情報の登録
            activeVoices[pointerId] = {
                oscillator: oscillator,
                gainNode: gainNode,
                state: 'active',
                startTime: audioCtx.currentTime,
                attackTime: attackTime
            };

            // ボイスの順序管理
            voiceOrder.push(pointerId);

            // デバッグ情報の更新（必要に応じて有効化）
            // updateDebugInfo(pointerId, frequency, volume, 'START');

        } catch (error) {
            console.error(`Failed to start oscillator for pointer ID ${pointerId}:`, error);
        }
    }

    function handlePolyphonyLimit() {
        const releasingVoices = voiceOrder.filter(id => activeVoices[id].state === 'releasing');
        if (releasingVoices.length > 0) {
            stopOscillator(releasingVoices[0]);
        } else {
            const oldestVoice = voiceOrder[0];
            stopOscillator(oldestVoice);
        }
    }

    function stopOscillator(pointerId) {
        const voice = activeVoices[pointerId];
        if (!voice) {
            console.warn(`No active voice found for pointer ID ${pointerId}`);
            return;
        }

        try {
            const releaseTime = parseFloat(releaseSlider.value);

            // ボイスの状態をリリース中に変更
            voice.state = 'releasing';

            voice.gainNode.gain.cancelScheduledValues(audioCtx.currentTime);
            voice.gainNode.gain.setValueAtTime(voice.gainNode.gain.value, audioCtx.currentTime);
            voice.gainNode.gain.linearRampToValueAtTime(0, audioCtx.currentTime + releaseTime);

            voice.oscillator.stop(audioCtx.currentTime + releaseTime);

            // onended イベントでクリーンアップ
            voice.oscillator.onended = () => {
                voice.oscillator.disconnect();
                voice.gainNode.disconnect();
                delete activeVoices[pointerId];
                const index = voiceOrder.indexOf(pointerId);
                if (index !== -1) {
                    voiceOrder.splice(index, 1);
                }
            };

            // ポインターの非アクティブ化
            if (pointers[pointerId]) {
                pointers[pointerId].classList.remove('active');
            }

            // デバッグ情報の更新（必要に応じて有効化）
            // updateDebugInfo(pointerId, null, null, 'STOP');

        } catch (error) {
            console.error(`Failed to stop oscillator for pointer ID ${pointerId}:`, error);
        }
    }

    function updateVoice(pointerId, frequency, volume) {
        const voice = activeVoices[pointerId];
        if (voice) {
            voice.oscillator.frequency.setValueAtTime(frequency, audioCtx.currentTime);

            const timeSinceStart = audioCtx.currentTime - voice.startTime;
            if (timeSinceStart > voice.attackTime) {
                voice.gainNode.gain.linearRampToValueAtTime(volume, audioCtx.currentTime + 0.05);
            }
            // アタックフェーズ中はゲインを変更しない
        }
    }

    function resumeAudioContext() {
        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
    }

    // === デバッグ関連 ===

    function createDebugEntry(message) {
        const entry = document.createElement('div');
        entry.classList.add('debug-entry');
        entry.textContent = message;
        debugLog.appendChild(entry);
        debugLog.scrollTop = debugLog.scrollHeight;
    }

    function updateDebugInfo(pointerId, frequency, volume, state) {
        let message = `Pointer ${pointerId}: `;
        switch(state) {
            case 'START':
                message += `Started with Frequency: ${frequency.toFixed(2)} Hz, Volume: ${(volume * 100).toFixed(2)}%`;
                break;
            case 'MOVE':
                message += `Moved to Frequency: ${frequency.toFixed(2)} Hz, Volume: ${(volume * 100).toFixed(2)}%`;
                break;
            case 'STOP':
                message += `Stopped`;
                break;
            case 'UPDATE':
                if (pointerId === 'delayTime') {
                    message += `Delay Time updated to ${frequency.toFixed(2)}s`;
                } else if (pointerId === 'feedback') {
                    message += `Feedback updated to ${(frequency * 100).toFixed(2)}%`;
                }
                break;
            default:
                message += `Unknown state`;
        }
        createDebugEntry(message);
    }

    // === キーボードイベント関連 ===

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);

    function handleKeyDown(event) {
        if (event.key === 'a' && !activeVoices['keyboard']) { // 'a'キーでオシレーターを開始
            const frequency = 440; // A4
            const volume = 0.5;
            const fakePointerEvent = { pointerId: 'keyboard' };
            startOscillator(fakePointerEvent, frequency, volume);

            // ポインターの表示
            if (!pointers['keyboard']) {
                pointers['keyboard'] = createPointer('pointerKeyboard', 'pointer1');
            }
            movePointer(pointers['keyboard'], synthArea.clientWidth / 2, synthArea.clientHeight / 2);

            // ポインターのアクティブ状態
            pointers['keyboard'].classList.add('active');

            // デバッグ情報の更新（必要に応じて有効化）
            // updateDebugInfo('keyboard', frequency, volume, 'START');
        }
    }

    function handleKeyUp(event) {
        if (event.key === 'a' && activeVoices['keyboard']) { // 'a'キーでオシレーターを停止
            stopOscillator('keyboard');

            // ポインターの削除
            if (pointers['keyboard']) {
                synthArea.removeChild(pointers['keyboard']);
                delete pointers['keyboard'];
            }
        }
    }

    // === ユーティリティ関数 ===

    function calculateFrequency(yPosition) {
        const height = synthArea.clientHeight;
        const relativeY = yPosition;
        const logMinFreq = Math.log10(minFrequency); // 動的な下限
        const logMaxFreq = Math.log10(maxFrequency); // 動的な上限
        const logFrequency = logMaxFreq - (relativeY / height) * (logMaxFreq - logMinFreq);
        return Math.pow(10, logFrequency);
    }

    function calculateVolume(xPosition) {
        const width = synthArea.clientWidth;
        const relativeX = xPosition;
        const dB = -40 + (relativeX / width) * 40; // -40dB to 0dB
        return baseVolume * Math.pow(10, dB / 20); // dBを線形スケールに変換
    }

    // === イベントリスナーの初期化 ===

    function initializeEventListeners() {
        // タッチ関連イベントは既に上記で設定済み
        // 必要に応じて追加のイベントリスナーをここに配置
    }

    // === 初期化処理 ===

    function init() {
        initializeUI();
        initializeEventListeners();
        synthArea.focus();
    }

    // 初期化の実行
    init();

})();
