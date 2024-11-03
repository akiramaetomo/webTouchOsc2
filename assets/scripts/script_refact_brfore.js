(function() {

    // 周波数とボリュームの表示ラベルを作成
    let infoDisplay = null; // ラベル表示用の要素、初期は null

    // 設定を適用する関数
    function applySettings() {
        let showInfo = localStorage.getItem("showInfo") === "true";
        let polyphony = parseInt(localStorage.getItem("polyphony") || "2", 10);


       // let showInfo=true;
        
        // ラベル表示の設定
        if (showInfo && !infoDisplay) {
            // ラベルがまだない場合、生成する
            infoDisplay = document.createElement("div");
            infoDisplay.id = "infoDisplay";
            infoDisplay.style.position = "absolute";
            infoDisplay.style.backgroundColor = "rgba(255, 255, 255, 0.8)";
            infoDisplay.style.padding = "5px";
            infoDisplay.style.borderRadius = "5px";
            infoDisplay.style.pointerEvents = "none";  // タッチの邪魔にならないように
            infoDisplay.style.display = "none";  // 初期状態は非表示
            document.body.appendChild(infoDisplay);
        } else if (!showInfo && infoDisplay) {
            // チェックが外れている場合、ラベルを削除
            infoDisplay.remove();
            infoDisplay = null;
        }

        // ポリフォニー数の設定
        MAX_POLYPHONY = Math.min(Math.max(polyphony, 1), 8);
    }

    // ページ読み込み時に設定を適用
    document.addEventListener("DOMContentLoaded", applySettings);
    window.addEventListener("pageshow", applySettings);


    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const activeVoices = {}; 
    const voiceOrder = [];   
    const pointers = {}; 
    const baseVolume = 0.1;
    const synthArea = document.getElementById('synthArea');

    // タッチ開始時にラベルを表示
    synthArea.addEventListener("pointerdown", (event) => {
        if (infoDisplay) {
            infoDisplay.style.display = "block";
 //           infoDisplay.innerText = "Frequency and Volume Display"; // デバッグ用の固定テキスト

        }
    });

    // タッチ移動時にラベルの位置と内容を更新
    synthArea.addEventListener("pointermove", (event) => {
        if (infoDisplay) {
            updateLabelPosition(event);
        }
    });

    // タッチ終了時にラベルを非表示
    synthArea.addEventListener("pointerup", () => {
        if (infoDisplay) {
            infoDisplay.style.display = "none";
        }
    });
    // ラベルの位置と内容を更新する関数
    function updateLabelPosition(event) {
        const rect = synthArea.getBoundingClientRect();
        const touchX = event.clientX - rect.left;
        const touchY = event.clientY - rect.top;

        const frequency = calculateFrequency(touchY);
        const volume = calculateVolume(touchX);
        const volumeDb = 20 * Math.log10(volume); // dB変換

        infoDisplay.style.left = `${event.clientX + 15}px`; // タッチ位置の右側に表示
        infoDisplay.style.top = `${event.clientY}px`;
        infoDisplay.innerHTML = `Frequency: ${frequency.toFixed(1)} Hz<br>Volume: ${volumeDb.toFixed(1)} dB`;
    
    };





    const waveformSelect = document.getElementById('waveform');

    const attackSlider = document.getElementById('attackSlider');
    const releaseSlider = document.getElementById('releaseSlider');

    const delayToggle = document.getElementById('delayToggle');
    const delayTimeSlider = document.getElementById('delayTime');
    const feedbackSlider = document.getElementById('feedback');

    const debugLog = document.getElementById('debugLog');


    // スライダーの初期値表示
    const attackDisplay = document.createElement('div');
    attackDisplay.textContent = `Attack Time: ${attackSlider.value}s`;
    const releaseDisplay = document.createElement('div');
    releaseDisplay.textContent = `Release Time: ${releaseSlider.value}s`;
    debugLog.appendChild(attackDisplay);
    debugLog.appendChild(releaseDisplay);

    // スライダーの値をリアルタイムで表示
    attackSlider.addEventListener('input', () => {
        attackDisplay.textContent = `Attack Time: ${attackSlider.value}s`;
    });

    releaseSlider.addEventListener('input', () => {
        releaseDisplay.textContent = `Release Time: ${releaseSlider.value}s`;
    });

    // 仕様１：ディレイエフェクトの設定
    const delayDisplayTime = document.createElement('div');
    delayDisplayTime.textContent = `Delay Time: ${delayTimeSlider.value}s`;
    const delayDisplayFeedback = document.createElement('div');
    delayDisplayFeedback.textContent = `Feedback: ${(feedbackSlider.value * 100).toFixed(2)}%`;
    debugLog.appendChild(delayDisplayTime);
    debugLog.appendChild(delayDisplayFeedback);

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

    // オーディオノードのセットアップ
    // マスターノードを作成し、全てのボイスがこのノードに接続する
    const masterGain = audioCtx.createGain();
    masterGain.connect(audioCtx.destination);

    // ディレイエフェクトのノードを作成
    const delayNode = audioCtx.createDelay(5.0); // 最大5秒
    delayNode.delayTime.value = parseFloat(delayTimeSlider.value);

    const feedbackGain = audioCtx.createGain();
    feedbackGain.gain.value = parseFloat(feedbackSlider.value);

    // ディレイエフェクトの接続設定
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

    delayToggle.addEventListener('change', () => {
        if (delayToggle.checked) {
        enableDelay();
        } else {
        disableDelay();
        }
    });

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

    function calculateFrequency(yPosition) {
        const height = synthArea.clientHeight;
        const relativeY = yPosition;
        const logMinFreq = Math.log10(27.5); // 27.5Hz
        const logMaxFreq = Math.log10(7040); // 7040Hz
        const logFrequency = logMaxFreq - (relativeY / height) * (logMaxFreq - logMinFreq);
        return Math.pow(10, logFrequency);
    }

    function calculateVolume(xPosition) {
        const width = synthArea.clientWidth;
        const relativeX = xPosition;
        const dB = -40 + (relativeX / width) * 40; // -40dB to 0dB
        return baseVolume * Math.pow(10, dB / 20); // dBを線形スケールに変換
    }

    function startOscillator(pointerEvent, frequency, volume) {
        const pointerId = pointerEvent.pointerId;

        // ポリフォニー制限に達している場合の処理
        if (voiceOrder.length >= MAX_POLYPHONY) {
        // リリース中のボイスを優先的に停止
        const releasingVoices = voiceOrder.filter(id => activeVoices[id].state === 'releasing');
        if (releasingVoices.length > 0) {
            const voiceToStop = releasingVoices[0];
            stopOscillator(voiceToStop);
        } else {
            // 全てのボイスがアクティブな場合、最も古いボイスを停止
            const oldestVoice = voiceOrder[0];
            stopOscillator(oldestVoice);
        }
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
        gainNode.connect(masterGain); // マスターノードに接続

        oscillator.start();


        activeVoices[pointerId] = {
            oscillator: oscillator,
            gainNode: gainNode,
            state: 'active', // ボイスの状態を管理
            startTime: audioCtx.currentTime, // 開始時間を記録
            attackTime: attackTime // アタックタイムを記録
        };


        // ボイスの順序管理
        voiceOrder.push(pointerId);

        // ポインターのアクティブ化
        if (pointers[pointerId]) {
            pointers[pointerId].classList.add('active');
        }

        // デバッグ情報の更新
        //updateDebugInfo(pointerId, frequency, volume, 'START');

        } catch (error) {
        console.error(`Failed to start oscillator for pointer ID ${pointerId}:`, error);
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

        // デバッグ情報の更新
        //updateDebugInfo(pointerId, null, null, 'STOP');

        } catch (error) {
        console.error(`Failed to stop oscillator for pointer ID ${pointerId}:`, error);
        }
    }

    function resumeAudioContext() {
        if (audioCtx.state === 'suspended') {
        audioCtx.resume();
        }
    }

    function createDebugEntry(message) {
        const entry = document.createElement('div');
        entry.classList.add('debug-entry');
        entry.textContent = message;
        debugLog.appendChild(entry);
        debugLog.scrollTop = debugLog.scrollHeight;
    }

    function updateDebugInfo(pointerId, frequency, volume, state) {
        let message = `Pointer ${pointerId}: `;
        if (state === 'START') {
        message += `Started with Frequency: ${frequency.toFixed(2)} Hz, Volume: ${(volume * 100).toFixed(2)}%`;
        } else if (state === 'MOVE') {
        message += `Moved to Frequency: ${frequency.toFixed(2)} Hz, Volume: ${(volume * 100).toFixed(2)}%`;
        } else if (state === 'STOP') {
        message += `Stopped`;
        } else if (state === 'UPDATE') {
        if (pointerId === 'delayTime') {
            message += `Delay Time updated to ${frequency.toFixed(2)}s`;
        } else if (pointerId === 'feedback') {
            message += `Feedback updated to ${(frequency * 100).toFixed(2)}%`;
        }
        } else {
        message += `Unknown state`;
        }
        createDebugEntry(message);
    }

    // Pointer Eventsの使用
    synthArea.addEventListener('pointerdown', (event) => {
        event.preventDefault();
        const rect = synthArea.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;

        const frequency = calculateFrequency(y);
        const volume = calculateVolume(x);

        startOscillator(event, frequency, volume);

        // ポインターの表示
        if (!pointers[event.pointerId]) {
        const className = Object.keys(pointers).length === 0 ? 'pointer1' : 'pointer2';
        pointers[event.pointerId] = createPointer(`pointer${event.pointerId}`, className);
        }
        movePointer(pointers[event.pointerId], x, y);

        // ポインターのアクティブ状態
        pointers[event.pointerId].classList.add('active');
    });

    synthArea.addEventListener('pointermove', (event) => {
        if (activeVoices[event.pointerId] && activeVoices[event.pointerId].state === 'active') {
            const rect = synthArea.getBoundingClientRect();
            const x = event.clientX - rect.left;
            const y = event.clientY - rect.top;
        
            const frequency = calculateFrequency(y);
            const volume = calculateVolume(x);
        
            const voice = activeVoices[event.pointerId];
            voice.oscillator.frequency.setValueAtTime(frequency, audioCtx.currentTime);
        
            // アタックフェーズが完了したかを確認
            const timeSinceStart = audioCtx.currentTime - voice.startTime;
            if (timeSinceStart > voice.attackTime) {
            // ゲインのスムーズな変更
            voice.gainNode.gain.linearRampToValueAtTime(volume, audioCtx.currentTime + 0.05);
            } else {
            // アタックフェーズ中はゲインを変更しない
            // 必要に応じてここで処理を追加できます
            }
        
            // ポインターの移動を最適化
            requestAnimationFrame(() => {
            movePointer(pointers[event.pointerId], x, y);
            });
        
            // デバッグ情報の更新
            //updateDebugInfo(event.pointerId, frequency, volume, 'MOVE');
        }
        });

    synthArea.addEventListener('pointerup', (event) => {
        event.preventDefault();
        stopOscillator(event.pointerId);

        // ポインターの削除
        if (pointers[event.pointerId]) {
        synthArea.removeChild(pointers[event.pointerId]);
        delete pointers[event.pointerId];
        }
    });

    synthArea.addEventListener('pointercancel', (event) => {
        event.preventDefault();
        stopOscillator(event.pointerId);

        // ポインターの削除
        if (pointers[event.pointerId]) {
        synthArea.removeChild(pointers[event.pointerId]);
        delete pointers[event.pointerId];
        }
    });

    // キーボードイベントの追加
    document.addEventListener('keydown', (event) => {
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

        // デバッグ情報の更新
        //updateDebugInfo('keyboard', frequency, volume, 'START');
        }
    });

    document.addEventListener('keyup', (event) => {
        if (event.key === 'a' && activeVoices['keyboard']) { // 'a'キーでオシレーターを停止
        stopOscillator('keyboard');

        // ポインターの削除
        if (pointers['keyboard']) {
            synthArea.removeChild(pointers['keyboard']);
            delete pointers['keyboard'];
        }
        }
    });

    // 初期フォーカスを synthArea に設定
    synthArea.focus();

  })();