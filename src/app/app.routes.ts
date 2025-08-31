import { Routes, UrlSegment } from "@angular/router";
import { AppComponent } from "./app.component";
import { MeetingComponent } from "./meeting/meeting.component";
import { PreviewComponent } from "./preview/preview.component";

// Custom route matcher
export function btcRouteMatcher(segments: UrlSegment[]) {
  const fullPath = segments.map(s => s.path).join('');

  // Regex: starts with btc, must have exactly 3 hyphens
  const pattern = /^btc-[^-]+-[^-]+$/;

  if (pattern.test(fullPath)) {
    return {
      consumed: segments
    };
  }
  return null;
}

export const routes: Routes = [
    { path: ':id', loadComponent: () => import('./preview/preview.component').then(c => c.PreviewComponent) },
    { path: "meeting/:id", loadComponent: () => import('./meeting/meeting.component').then(c => c.MeetingComponent) },
    { path: '**', redirectTo: ''}
]