import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class ScreenRecorderService {
  private mediaRecorder?: MediaRecorder;
  recordedChunks: Blob[] = [];

  async startRecording(options: { video: boolean, audio: boolean }) {
    try {
      let stream: MediaStream;

      if (options.video && options.audio) {
        // Screen + Audio
        const screenStream = await (navigator.mediaDevices as any).getDisplayMedia({
          video: true,
          audio: true
        });

        const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const combinedStream = new MediaStream([
          ...screenStream.getTracks(),
          ...micStream.getTracks()
        ]);

        stream = combinedStream;
      } else if (options.video && !options.audio) {
        // Screen only
        stream = await (navigator.mediaDevices as any).getDisplayMedia({ video: true, audio: false });
      } else if (!options.video && options.audio) {
        // Audio only
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } else {
        throw new Error('At least one of video or audio must be true.');
      }

      this.recordedChunks = [];
      this.mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm; codecs=vp9,opus' });

      this.mediaRecorder.ondataavailable = (event: BlobEvent) => {
        if (event.data.size > 0) {
          this.recordedChunks.push(event.data);
        }
      };

      this.mediaRecorder.start();
    } catch (err) {
      console.error('Error starting recording:', err);
      throw err;
    }
  }

  stopRecording(): Promise<Blob> {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder) {
        return reject('No active recording');
      }

      this.mediaRecorder.onstop = () => {
        const blob = new Blob(this.recordedChunks, { type: 'video/webm' });
        resolve(blob);
      };

      this.mediaRecorder.stop();
    });
  }

  downloadRecording(blob: Blob, filename: string = 'recording.wav') {
    this.downloadRecordingAsWav(blob);
    // const url = URL.createObjectURL(blob);
    // const a = document.createElement('a');
    // a.href = url;
    // a.download = filename;
    // a.click();
    // URL.revokeObjectURL(url);
  }

  downloadRecordingAsWav(blob: Blob, filename: string = 'recording.wav') {
    const audioCtx = new AudioContext({ sampleRate: 16000 });

    blob.arrayBuffer()
      .then(arrayBuffer => audioCtx.decodeAudioData(arrayBuffer))
      .then(audioBuffer => {
        // Convert stereo → mono for Whisper
        const offlineCtx = new OfflineAudioContext(1, audioBuffer.duration * 16000, 16000);
        const source = offlineCtx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(offlineCtx.destination);
        source.start(0);

        return offlineCtx.startRendering();
      })
      .then(renderedBuffer => {
        const wavBlob = this.audioBufferToWavBlob(renderedBuffer);

        // Trigger download
        const url = URL.createObjectURL(wavBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
      });
  }

  private audioBufferToWavBlob(buffer: AudioBuffer): Blob {
    const numChannels = 1;
    const sampleRate = buffer.sampleRate;
    const samples = buffer.getChannelData(0);
    const bufferLength = samples.length * 2 + 44;

    const arrayBuffer = new ArrayBuffer(bufferLength);
    const view = new DataView(arrayBuffer);

    // WAV header
    this.writeString(view, 0, 'RIFF');
    view.setUint32(4, bufferLength - 8, true);
    this.writeString(view, 8, 'WAVE');
    this.writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, numChannels * 2, true);
    view.setUint16(34, 16, true);
    this.writeString(view, 36, 'data');
    view.setUint32(40, samples.length * 2, true);

    // PCM samples
    let offset = 44;
    for (let i = 0; i < samples.length; i++, offset += 2) {
      const s = Math.max(-1, Math.min(1, samples[i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    }

    return new Blob([view], { type: 'audio/wav' });
  }

  private writeString(view: DataView, offset: number, str: string): void {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  }
}
