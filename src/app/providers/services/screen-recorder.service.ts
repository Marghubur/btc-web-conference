import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export type RecordingState = 'idle' | 'recording' | 'paused';

export interface RecordingOptions {
  video: boolean;
  audio: boolean;
  source: 'screen' | 'camera';
}

@Injectable({
  providedIn: 'root'
})
export class ScreenRecorderService {
  private mediaRecorder?: MediaRecorder;
  private recordedChunks: Blob[] = [];
  private currentStream?: MediaStream;

  // Observable for recording state
  private recordingState$ = new BehaviorSubject<RecordingState>('idle');
  private recordingDuration$ = new BehaviorSubject<number>(0);
  private durationInterval?: any;

  constructor(private http: HttpClient) { }

  /**
   * Get the current recording state as an observable
   */
  getRecordingState(): Observable<RecordingState> {
    return this.recordingState$.asObservable();
  }

  /**
   * Get record8/ng duration in seconds as an observable
   */
  getRecordingDuration(): Observable<number> {
    return this.recordingDuration$.asObservable();
  }

  /**
   * Check if currently recording
   */
  isRecording(): boolean {
    return this.recordingState$.value === 'recording';
  }

  /**
   * Check if recording is paused
   */
  isPaused(): boolean {
    return this.recordingState$.value === 'paused';
  }

  /**
   * Start recording with specified options
   * @param options - Recording options (video, audio, source)
   */
  async startRecording(options: RecordingOptions): Promise<void> {
    try {
      let stream: MediaStream;

      if (options.source === 'camera') {
        // Camera recording (local webcam)
        stream = await this.getCameraStream(options);
      } else {
        // Screen recording
        stream = await this.getScreenStream(options);
      }

      this.currentStream = stream;
      this.recordedChunks = [];

      // Determine MIME type based on recording type
      const mimeType = options.video
        ? 'video/webm; codecs=vp9,opus'
        : 'audio/webm; codecs=opus';

      this.mediaRecorder = new MediaRecorder(stream, { mimeType });

      this.mediaRecorder.ondataavailable = (event: BlobEvent) => {
        if (event.data.size > 0) {
          this.recordedChunks.push(event.data);
        }
      };

      this.mediaRecorder.onpause = () => {
        this.recordingState$.next('paused');
        this.stopDurationTimer();
      };

      this.mediaRecorder.onresume = () => {
        this.recordingState$.next('recording');
        this.startDurationTimer();
      };

      this.mediaRecorder.onstop = () => {
        this.recordingState$.next('idle');
        this.stopDurationTimer();
        this.recordingDuration$.next(0);
      };

      // Handle track ended (user stops sharing)
      stream.getTracks().forEach(track => {
        track.onended = () => {
          if (this.isRecording() || this.isPaused()) {
            this.stopRecording();
          }
        };
      });

      this.mediaRecorder.start(1000); // Collect data every second
      this.recordingState$.next('recording');
      this.startDurationTimer();

    } catch (err) {
      console.error('Error starting recording:', err);
      throw err;
    }
  }

  /**
   * Get camera stream for recording
   */
  private async getCameraStream(options: RecordingOptions): Promise<MediaStream> {
    const constraints: MediaStreamConstraints = {
      video: options.video ? { facingMode: 'user', width: 1280, height: 720 } : false,
      audio: options.audio
    };

    return navigator.mediaDevices.getUserMedia(constraints);
  }

  /**
   * Get screen stream for recording
   */
  private async getScreenStream(options: RecordingOptions): Promise<MediaStream> {
    if (options.video && options.audio) {
      // Screen + Audio
      const screenStream = await (navigator.mediaDevices as any).getDisplayMedia({
        video: true,
        audio: true
      });

      const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      return new MediaStream([
        ...screenStream.getTracks(),
        ...micStream.getTracks()
      ]);
    } else if (options.video && !options.audio) {
      // Screen only
      return (navigator.mediaDevices as any).getDisplayMedia({ video: true, audio: false });
    } else if (!options.video && options.audio) {
      // Audio only
      return navigator.mediaDevices.getUserMedia({ audio: true });
    } else {
      throw new Error('At least one of video or audio must be true.');
    }
  }

  /**
   * Pause the current recording
   */
  pauseRecording(): void {
    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      this.mediaRecorder.pause();
    }
  }

  /**
   * Resume a paused recording
   */
  resumeRecording(): void {
    if (this.mediaRecorder && this.mediaRecorder.state === 'paused') {
      this.mediaRecorder.resume();
    }
  }

  /**
   * Toggle between pause and resume
   */
  togglePauseResume(): void {
    if (this.isRecording()) {
      this.pauseRecording();
    } else if (this.isPaused()) {
      this.resumeRecording();
    }
  }

  /**
   * Stop the current recording and return the blob
   */
  stopRecording(): Promise<Blob> {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder) {
        return reject('No active recording');
      }

      this.mediaRecorder.onstop = () => {
        // Stop all tracks
        this.currentStream?.getTracks().forEach(track => track.stop());

        const mimeType = this.recordedChunks[0]?.type || 'video/webm';
        const blob = new Blob(this.recordedChunks, { type: mimeType });

        this.recordingState$.next('idle');
        this.stopDurationTimer();
        this.recordingDuration$.next(0);

        resolve(blob);
      };

      if (this.mediaRecorder.state !== 'inactive') {
        this.mediaRecorder.stop();
      } else {
        reject('Recording already stopped');
      }
    });
  }

  /**
   * Cancel the current recording without saving
   */
  cancelRecording(): void {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }
    this.currentStream?.getTracks().forEach(track => track.stop());
    this.recordedChunks = [];
    this.recordingState$.next('idle');
    this.stopDurationTimer();
    this.recordingDuration$.next(0);
  }

  private startDurationTimer(): void {
    this.durationInterval = setInterval(() => {
      this.recordingDuration$.next(this.recordingDuration$.value + 1);
    }, 1000);
  }

  private stopDurationTimer(): void {
    if (this.durationInterval) {
      clearInterval(this.durationInterval);
      this.durationInterval = undefined;
    }
  }

  downloadRecording(blob: Blob, filename: string = 'recording') {
    const extension = blob.type.includes('audio') ? 'wav' : 'webm';

    if (blob.type.includes('audio')) {
      this.downloadRecordingAsWav(blob, `${filename}.wav`);
    } else {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${filename}.${extension}`;
      a.click();
      URL.revokeObjectURL(url);
    }
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

  downloadAudioToText(blob: Blob, filename: string = 'recording.wav') {
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

        let formData = new FormData();
        formData.append('file', wavBlob);
        this.http.post("https://www.axilcorps.com/stt/transcribe/audio-to-text", formData).subscribe({
          next: (res: any) => {
            if (res && res._response_body) {
              // Trigger download
              const text = res._response_body;
              const blob = new Blob([text], { type: 'text/plain' });
              const url = window.URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = filename;
              a.click();
              URL.revokeObjectURL(url);
            }
          },
          error: (err: HttpErrorResponse) => {
            if (err.error instanceof ErrorEvent) {
              console.error('An error occurred:', err.error.message);
            } else {
              console.error(
                `Backend returned code ${err.status}, ` +
                `body was: ${err.error}`);
            }
          }
        })
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
