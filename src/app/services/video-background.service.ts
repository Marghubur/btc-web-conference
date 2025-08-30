// services/virtual-background.service.ts
import { Injectable } from '@angular/core';
import { 
  BackgroundBlur,
  supportsBackgroundProcessors,
  VirtualBackground
} from '@livekit/track-processors';
import { LocalVideoTrack } from 'livekit-client';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class VideoBackgroundService {
  private currentBackground$ = new BehaviorSubject<BackgroundOption>({
    id: 'none',
    type: BackgroundType.NONE,
    name: 'No Background'
  });

  private isProcessing$ = new BehaviorSubject<boolean>(false);
  private isInitialized = false;

  // Default background options
  readonly defaultBackgrounds: BackgroundOption[] = [
    { id: 'none', type: BackgroundType.NONE, name: 'No Background', thumbnailUrl: 'assets/none-thumb.png' },
    // { id: 'blur-light', type: BackgroundType.BLUR, name: 'Light Blur', thumbnailUrl: 'assets/blur.jpg', blurRadius: 5 },
    // { id: 'blur-medium', type: BackgroundType.BLUR, name: 'Medium Blur', thumbnailUrl: 'assets/blur.jpg', blurRadius: 10 },
    { id: 'blur-heavy', type: BackgroundType.BLUR, name: 'Heavy Blur', thumbnailUrl: 'assets/blur.jpg', blurRadius: 20 },
    { id: 'office', type: BackgroundType.IMAGE, name: 'Modern Office', thumbnailUrl: 'assets/office.jpg', sourceUrl: 'assets/office.jpg' },
    { id: 'home', type: BackgroundType.IMAGE, name: 'Home Office', thumbnailUrl: 'assets/home.jpg', sourceUrl: 'assets/home.jpg' },
    { id: 'library', type: BackgroundType.IMAGE, name: 'Library', thumbnailUrl: 'assets/library.jpg', sourceUrl: 'assets/library.jpg' },
    { id: 'nature', type: BackgroundType.IMAGE, name: 'Nature', thumbnailUrl: 'assets/nature.jpg', sourceUrl: 'assets/nature.jpg' },
    { id: 'abstract', type: BackgroundType.IMAGE, name: 'Abstract', thumbnailUrl: 'assets/abstract.jpg', sourceUrl: 'assets/abstract.jpg' },
  ];

  constructor() {}

  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    this.isInitialized = true;
  }

  async applyBackground(track: LocalVideoTrack, background: BackgroundOption): Promise<void> {
    this.isProcessing$.next(true);

    try {
      if (!supportsBackgroundProcessors()) {
        console.warn('Background processors are not supported in this browser');
        this.currentBackground$.next({ id: 'none', type: BackgroundType.NONE, name: 'No Background' });
        return;
      }

      // Stop any previous processor
      await track.stopProcessor();

      if (background.type === BackgroundType.NONE) {
        this.currentBackground$.next(background);
        return;
      }

      if (background.type === BackgroundType.BLUR) {
        const blurRadius = background.blurRadius || 10;
        const blurProcessor = BackgroundBlur(blurRadius);
        await track.setProcessor(blurProcessor);
      }

      if (background.type === BackgroundType.IMAGE && background.sourceUrl) {
        const replacementProcessor = VirtualBackground(background.sourceUrl);
        await track.setProcessor(replacementProcessor);
      }

      this.currentBackground$.next(background);
    } catch (error) {
      console.error('Failed to apply background:', error);
      throw error;
    } finally {
      this.isProcessing$.next(false);
    }
  }

  async removeBackground(track: LocalVideoTrack): Promise<void> {
    try {
      await track.stopProcessor();
      this.currentBackground$.next({ id: 'none', type: BackgroundType.NONE, name: 'No Background' });
    } catch (error) {
      console.error('Error removing background processor:', error);
    }
  }

  async updateBlurRadius(track: LocalVideoTrack, radius: number): Promise<void> {
    const currentBg = this.currentBackground$.value;
    if (currentBg.type !== BackgroundType.BLUR) return;

    await this.applyBackground(track, { ...currentBg, blurRadius: radius });
  }

  getCurrentBackground(): Observable<BackgroundOption> {
    return this.currentBackground$.asObservable();
  }

  getProcessingStatus(): Observable<boolean> {
    return this.isProcessing$.asObservable();
  }

  getBackgrounds(): BackgroundOption[] {
    return [...this.defaultBackgrounds];
  }

  async addCustomBackground(file: File): Promise<BackgroundOption> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        const customBackground: BackgroundOption = {
          id: `custom-${Date.now()}`,
          type: BackgroundType.IMAGE,
          name: file.name.split('.')[0] || 'Custom Background',
          sourceUrl: dataUrl,
          thumbnailUrl: dataUrl,
        };
        resolve(customBackground);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  dispose(track?: LocalVideoTrack): void {
    if (track) {
      track.stopProcessor().catch(() => {});
    }
    this.isInitialized = false;
  }
}

export enum BackgroundType {
  NONE = 'none',
  BLUR = 'blur',
  IMAGE = 'image'
}

export interface BackgroundOption {
  id: string;
  type: BackgroundType;
  name: string;
  thumbnailUrl?: string;
  sourceUrl?: string;
  blurRadius?: number;
}

export interface BackgroundConfig {
  blurRadius?: number;
  imagePath?: string;
}