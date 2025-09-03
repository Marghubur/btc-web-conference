// // src/app/services/whisper-transcription.service.ts
// import { Injectable } from '@angular/core';
// import { pipeline } from '@xenova/transformers';

// type TranscriberFn = (
//   audio:
//     | ArrayBuffer
//     | Float32Array
//     | { array: Float32Array; sampling_rate: number },
//   opts?: Record<string, any>
// ) => Promise<{ text: string }>;

// @Injectable({ providedIn: 'root' })
// export class WhisperTranscriptionService {
//   private transcriber?: TranscriberFn;
//   private whisperPipeline: any | null = null;
//   // Choose a lightweight model for browser usage
//   private readonly modelId = 'Xenova/whisper-tiny.en';

//   /** Load Whisper once and cache the callable transcriber */
//   async init(): Promise<void> {
//     if (this.transcriber) return;
//     const p = await pipeline('automatic-speech-recognition', this.modelId);
//     // p is a callable function in transformers.js
//     this.transcriber = p as unknown as TranscriberFn;
//   }

//   /** Transcribe PCM audio. Accepts Float32Array @ sampleRate (Hz). */
//   async transcribePCM(pcm: Float32Array, sampleRate: number): Promise<string> {
//     if (!this.transcriber) await this.init();

//     // Transformers.js accepts raw PCM as { array, sampling_rate }
//     const result = await this.transcriber!(
//       { array: pcm, sampling_rate: sampleRate },
//       {
//         // tune as needed:
//         chunk_length_s: 15,
//         stride_length_s: 5,
//         // language: 'en'  // if you want to fix the language
//       }
//     );
//     return result?.text ?? '';
//   }

//   /** Utility to download transcript as .txt */
//   downloadTranscript(text: string, name = 'transcript.txt') {
//     const blob = new Blob([text], { type: 'text/plain' });
//     const url = URL.createObjectURL(blob);
//     const a = document.createElement('a');
//     a.href = url;
//     a.download = name;
//     a.click();
//     URL.revokeObjectURL(url);
//   }


//    private async loadModel() {
//     if (!this.whisperPipeline) {
//       console.log('Loading Whisper model...');
//       this.whisperPipeline = await pipeline('automatic-speech-recognition', 'Xenova/whisper-tiny.en');
//       console.log('Whisper model loaded.');
//     }
//   }

//   async transcribe(recordedChunks: Blob[]): Promise<string> {
//     if (!recordedChunks || recordedChunks.length === 0) {
//       throw new Error('No audio chunks available for transcription.');
//     }

//     await this.loadModel();

//     // Merge chunks into single blob
//     const audioBlob = new Blob(recordedChunks, { type: 'audio/webm' });
//     const audioFile = new File([audioBlob], 'recording.webm', { type: 'audio/webm' });

//     console.log('Running transcription...');
//     const result = await this.whisperPipeline(audioFile);
//     console.log('Transcription result:', result);

//     return result.text;
//   }

//   /**
//    * Utility: Download transcript as .txt
//    */
//   downloadAudioTranscript(transcript: string, filename: string = 'transcript.txt') {
//     const blob = new Blob([transcript], { type: 'text/plain' });
//     const url = URL.createObjectURL(blob);

//     const a = document.createElement('a');
//     a.href = url;
//     a.download = filename;
//     a.click();

//     URL.revokeObjectURL(url);
//   }

//   async transcribeAudio(recordedChunks: Blob[]): Promise<string> {
//     return new Promise((resolve, reject) => {
//       // Check if Speech Recognition is supported
//       if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
//         reject(new Error('Speech recognition not supported in this browser. Please use Chrome or Edge.'));
//         return;
//       }

//       // Combine all chunks into single blob
//       const audioBlob = new Blob(recordedChunks, { type: 'audio/webm' });
      
//       // Create audio URL
//       const audioUrl = URL.createObjectURL(audioBlob);
//       const audio = new Audio(audioUrl);

//       // Initialize Speech Recognition
//       const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
//       const recognition = new SpeechRecognition();

//       // Configure recognition settings
//       recognition.continuous = true;
//       recognition.interimResults = false;
//       recognition.lang = 'en-US';
//       recognition.maxAlternatives = 1;

//       let finalTranscript = '';
//       let isRecognitionActive = false;

//       recognition.onstart = () => {
//         isRecognitionActive = true;
//         console.log('Speech recognition started');
//       };

//       recognition.onresult = (event: any) => {
//         for (let i = event.resultIndex; i < event.results.length; i++) {
//           const transcript = event.results[i][0].transcript;
//           if (event.results[i].isFinal) {
//             finalTranscript += transcript + ' ';
//           }
//         }
//       };

//       recognition.onend = () => {
//         isRecognitionActive = false;
//         // Clean up
//         URL.revokeObjectURL(audioUrl);
//         resolve(finalTranscript.trim());
//       };

//       recognition.onerror = (event: any) => {
//         isRecognitionActive = false;
//         URL.revokeObjectURL(audioUrl);
//         reject(new Error(`Speech recognition error: ${event.error}`));
//       };

//       // Handle audio events
//       audio.onloadeddata = () => {
//         recognition.start();
//         audio.play().catch(error => {
//           console.error('Audio playback error:', error);
//           reject(new Error('Failed to play audio for transcription'));
//         });
//       };

//       audio.onended = () => {
//         // Give recognition a moment to process final words
//         setTimeout(() => {
//           if (isRecognitionActive) {
//             recognition.stop();
//           }
//         }, 1000);
//       };

//       audio.onerror = () => {
//         reject(new Error('Failed to load audio for transcription'));
//       };
//     });
//   }

//   // Download transcript as formatted text with timestamps
//   downloadFormattedTranscript(transcript: string, recordingDuration?: number, filename: string = 'formatted-transcript.txt'): void {
//     if (!transcript || transcript.trim().length === 0) {
//       console.warn('No transcript content to download');
//       return;
//     }

//     const timestamp = new Date().toLocaleString();
    
//     const formattedTranscript = `AUDIO TRANSCRIPT
// ================

// Generated: ${timestamp}
// Language: English (en-US)
// Method: Web Speech API

// CONTENT
// =======

// ${transcript.trim()}

// STATISTICS
// ==========
// Characters: ${transcript.length}
// ---
// Generated using Web Speech API in Angular 18`;

//     const blob = new Blob([formattedTranscript], { type: 'text/plain;charset=utf-8' });
//     const url = URL.createObjectURL(blob);
//     const link = document.createElement('a');
//     link.href = url;
//     link.download = filename;
    
//     document.body.appendChild(link);
//     link.click();
//     document.body.removeChild(link);
//     URL.revokeObjectURL(url);
//   }
// }
