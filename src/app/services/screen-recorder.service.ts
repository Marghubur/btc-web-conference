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

  downloadRecording(blob: Blob, filename: string = 'recording.webm') {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }
}
