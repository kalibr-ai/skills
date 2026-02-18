(function () {
  'use strict';

  // --- CSS Animations (injected once) ---
  const STYLE_ID = 'oc-voice-animations';
  if (!document.getElementById(STYLE_ID)) {
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      @keyframes oc-pulse {
        0%   { box-shadow: 0 0 0 0 rgba(192,57,43,0.6); }
        70%  { box-shadow: 0 0 0 10px rgba(192,57,43,0); }
        100% { box-shadow: 0 0 0 0 rgba(192,57,43,0); }
      }
      @keyframes oc-spin {
        0%   { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    `;
    document.head.appendChild(style);
  }

  const TRANSCRIBE_URL = location.port === '8443' ? '/transcribe' : 'http://127.0.0.1:18790/transcribe';
  const MIN_TEXT_CHARS = 6;
  const MIN_CONFIDENCE = 0.35;
  const MAX_NO_SPEECH = 0.85;

  let mediaRecorder = null;
  let audioChunks = [];
  let recording = false;
  let processing = false;
  let stream = null;
  let btn = null;
  let observer = null;
  let recordingStartedAt = 0;
  const MIN_RECORDING_MS = 250;

  const MIC_ICON = `
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M9 8a3 3 0 1 1 6 0v4a3 3 0 1 1 -6 0z" />
      <path d="M5 10v2a7 7 0 0 0 14 0v-2" />
      <path d="M12 19v3" />
      <path d="M8 22h8" />
    </svg>
  `;

  const STOP_ICON = `
    <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" aria-hidden="true">
      <rect x="5" y="5" width="14" height="14" rx="2.5" ry="2.5" />
    </svg>
  `;

  const HOURGLASS_ICON = `
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M7 4h10" />
      <path d="M7 20h10" />
      <path d="M8 4c0 4 4 4 4 8s-4 4-4 8" />
      <path d="M16 4c0 4-4 4-4 8s4 4 4 8" />
    </svg>
  `;

  function getApp() {
    return document.querySelector('openclaw-app');
  }

  function sendMessage(text) {
    const app = getApp();
    if (!app || typeof app.handleSendChat !== 'function') return false;
    app.handleSendChat(text);
    return true;
  }

  function setIdleStyle() {
    if (!btn) return;
    btn.style.background = '#e52b31';
    btn.style.border = '1px solid #d3272f';
    btn.style.color = '#fff';
    btn.style.boxShadow = '0 1px 3px rgba(0,0,0,0.16)';
    btn.style.animation = 'none';
    btn.innerHTML = MIC_ICON;
  }

  function setRecordingStyle() {
    if (!btn) return;
    btn.style.background = '#c0392b';
    btn.style.border = '1px solid #ffffff';
    btn.style.color = '#fff';
    btn.style.boxShadow = '0 0 0 6px rgba(255,255,255,0.16), 0 1px 3px rgba(0,0,0,0.16)';
    btn.style.animation = 'oc-pulse 1.4s ease-in-out infinite';
    btn.innerHTML = STOP_ICON;
  }

  function setProcessingStyle() {
    if (!btn) return;
    btn.style.background = '#d6452f';
    btn.style.border = '1px solid #ffffff';
    btn.style.color = '#fff';
    btn.style.boxShadow = '0 1px 3px rgba(0,0,0,0.16)';
    btn.style.animation = 'none';
    btn.innerHTML = `<span style="display:inline-flex;animation:oc-spin 1.2s linear infinite">${HOURGLASS_ICON}</span>`;
  }

  function styleInline(sendBtn) {
    if (!btn) return;
    const h = Math.round(sendBtn?.getBoundingClientRect?.().height || 52);
    const radius = Math.max(10, Math.round(h * 0.22));
    btn.style.cssText = `
      width:${h}px;height:${h}px;border-radius:${radius}px;
      border:1px solid #d3272f;background:#e52b31;color:#fff;
      display:inline-flex;align-items:center;justify-content:center;
      cursor:pointer;user-select:none;flex:0 0 auto;margin:0 10px;
      box-shadow:0 1px 3px rgba(0,0,0,0.16);transition:all .15s ease;
    `;
  }

  function styleFloating() {
    if (!btn) return;
    btn.style.cssText = `
      position:fixed;bottom:24px;right:24px;z-index:99999;
      width:48px;height:48px;border-radius:50%;
      border:1px solid #d3272f;background:#e52b31;color:#fff;
      display:flex;align-items:center;justify-content:center;
      cursor:pointer;user-select:none;box-shadow:0 2px 8px rgba(0,0,0,.25);
    `;
  }

  function bindButton(el) {
    if (!el || el.dataset.ocVoiceBound === '1') return;
    el.dataset.ocVoiceBound = '1';
    const handler = (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggle();
    };
    el.addEventListener('click', handler);
    el.addEventListener('pointerdown', handler);
  }

  function findSendButton() {
    return Array.from(document.querySelectorAll('button')).find((b) => /send/i.test((b.textContent || '').trim()));
  }

  function renderButton() {
    if (!btn) {
      btn = document.createElement('button');
      btn.id = 'oc-voice-btn';
      btn.type = 'button';
      btn.title = 'Spracheingabe';
      bindButton(btn);
    }

    const sendBtn = findSendButton();
    if (sendBtn && sendBtn.parentElement) {
      styleInline(sendBtn);
      if (btn.parentElement !== sendBtn.parentElement || btn.nextSibling !== sendBtn) {
        btn.remove();
        sendBtn.parentElement.insertBefore(btn, sendBtn);
      }
    } else if (!document.body.contains(btn)) {
      styleFloating();
      document.body.appendChild(btn);
    }

    if (recording) setRecordingStyle();
    else if (processing) setProcessingStyle();
    else setIdleStyle();
  }

  async function sendToTranscribe(blob) {
    processing = true;
    setProcessingStyle();
    try {
      const resp = await fetch(TRANSCRIBE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/octet-stream' },
        body: blob,
      });
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      const data = await resp.json();
      const text = (data.text || '').trim();
      const confidence = typeof data.confidence === 'number' ? data.confidence : null;
      const noSpeech = typeof data.no_speech_prob === 'number' ? data.no_speech_prob : null;

      if (!text) return;
      if (text.length < MIN_TEXT_CHARS) return;
      if (confidence !== null && confidence < MIN_CONFIDENCE) return;
      if (noSpeech !== null && noSpeech > MAX_NO_SPEECH) return;

      sendMessage(text);
    } catch (_) {
    } finally {
      processing = false;
      setIdleStyle();
    }
  }

  async function startRecording() {
    if (recording || processing) return;
    try {
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
        stream = null;
      }

      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunks = [];

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')
          ? 'audio/ogg;codecs=opus' : '';

      mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : {});

      mediaRecorder.addEventListener('dataavailable', (e) => {
        if (e.data?.size > 0) audioChunks.push(e.data);
      });

      mediaRecorder.addEventListener('stop', () => {
        if (stream) {
          stream.getTracks().forEach((t) => t.stop());
          stream = null;
        }
        recording = false;
        recordingStartedAt = 0;

        const total = audioChunks.reduce((s, c) => s + c.size, 0);
        if (!audioChunks.length || total < 20) {
          mediaRecorder = null;
          setIdleStyle();
          return;
        }

        const blob = new Blob(audioChunks, { type: mediaRecorder?.mimeType || 'audio/webm' });
        audioChunks = [];
        mediaRecorder = null;
        sendToTranscribe(blob);
      }, { once: true });

      mediaRecorder.start();
      recording = true;
      recordingStartedAt = Date.now();
      setRecordingStyle();
    } catch (_) {
      recording = false;
      mediaRecorder = null;
      setIdleStyle();
    }
  }

  function stopRecording() {
    if (!recording) return;

    const elapsed = Date.now() - recordingStartedAt;
    if (elapsed < MIN_RECORDING_MS) {
      setTimeout(() => {
        if (recording) stopRecording();
      }, MIN_RECORDING_MS - elapsed);
      return;
    }

    if (mediaRecorder?.state === 'recording') {
      try { mediaRecorder.requestData(); } catch (_) {}
      try { mediaRecorder.stop(); } catch (_) {
        recording = false;
        mediaRecorder = null;
        setIdleStyle();
      }
      return;
    }

    recording = false;
    mediaRecorder = null;
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      stream = null;
    }
    setIdleStyle();
  }

  function toggle() {
    // Self-heal stale state: if UI thinks recording but recorder is gone/stopped
    if (recording && (!mediaRecorder || mediaRecorder.state !== 'recording')) {
      recording = false;
      mediaRecorder = null;
      setIdleStyle();
    }

    if (recording) stopRecording();
    else startRecording();
  }

  function boot() {
    renderButton();
    let queued = false;
    observer = new MutationObserver(() => {
      if (recording || processing) return;
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        renderButton();
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(boot, 500));
  } else {
    setTimeout(boot, 500);
  }
})();
