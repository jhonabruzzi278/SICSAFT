// Feedback sonoro/háptico al escanear — beep vía Web Audio API (no hay
// archivo de audio que cachear/descargar, funciona offline) + vibración.
function playBeep(success: boolean): void {
  try {
    const AudioContextClass =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;

    const ctx = new AudioContextClass();
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = success ? 880 : 220;
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.15);
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start();
    oscillator.stop(ctx.currentTime + 0.15);
    oscillator.onended = () => ctx.close();
  } catch {
    // audio no disponible; el feedback visual/háptico sigue funcionando
  }
}

export function triggerScanFeedback(found: boolean): void {
  if (navigator.vibrate) {
    navigator.vibrate(found ? 60 : [40, 60, 40]);
  }
  playBeep(found);
}
