// highlight.pipe.ts

import { Pipe, PipeTransform } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

/**
 * Pipe to highlight search matches in text.
 * 
 * Usage:
 * <span [innerHTML]="user.name | highlight:searchQuery"></span>
 */
@Pipe({
    name: 'highlight',
    standalone: true
})
export class HighlightPipe implements PipeTransform {
    constructor(private sanitizer: DomSanitizer) { }

    transform(value: string | null | undefined, searchTerm: string): SafeHtml {
        if (!value) return '';
        if (!searchTerm || searchTerm.length < 2) {
            return value;
        }

        // Escape special regex characters in the search term
        const escapedTerm = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

        // Create case-insensitive regex
        const regex = new RegExp(`(${escapedTerm})`, 'gi');

        // Replace matches with highlighted version
        const highlighted = value.replace(regex, '<mark>$1</mark>');

        return this.sanitizer.bypassSecurityTrustHtml(highlighted);
    }
}