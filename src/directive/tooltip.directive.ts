// tooltip.directive.ts
import {
  Directive,
  ElementRef,
  Input,
  Renderer2,
  HostListener,
  OnDestroy
} from '@angular/core';

@Directive({
  selector: '[appTooltip]',
  standalone: true
})
export class TooltipDirective implements OnDestroy {
  @Input('title') tooltipText: string = '';
  @Input('data-bs-placement') placement: string = 'top';

  private tooltipElement: HTMLElement | null = null;

  constructor(private el: ElementRef, private renderer: Renderer2) {}

  @HostListener('mouseenter')
  onMouseEnter() {
    if (!this.tooltipText) return;
    this.createTooltip();
  }

  @HostListener('mouseleave')
  onMouseLeave() {
    this.destroyTooltip();
  }

  private createTooltip() {
    if (this.tooltipElement) return;

    const tooltip = this.renderer.createElement('div');
    this.renderer.addClass(tooltip, 'custom-tooltip');
    this.renderer.addClass(tooltip, `custom-tooltip-${this.placement}`);
    tooltip.innerText = this.tooltipText;

    this.renderer.appendChild(document.body, tooltip);

    const hostPos = this.el.nativeElement.getBoundingClientRect();
    const tooltipPos = tooltip.getBoundingClientRect();

    let top, left;

    switch (this.placement) {
      case 'top':
        top = hostPos.top - tooltipPos.height - 8;
        left = hostPos.left + (hostPos.width - tooltipPos.width) / 2;
        break;
      case 'bottom':
        top = hostPos.bottom + 8;
        left = hostPos.left + (hostPos.width - tooltipPos.width) / 2;
        break;
      case 'left':
        top = hostPos.top + (hostPos.height - tooltipPos.height) / 2;
        left = hostPos.left - tooltipPos.width - 8;
        break;
      case 'right':
        top = hostPos.top + (hostPos.height - tooltipPos.height) / 2;
        left = hostPos.right + 8;
        break;
      default:
        top = hostPos.bottom + 8;
        left = hostPos.left + (hostPos.width - tooltipPos.width) / 2;
    }

    this.renderer.setStyle(tooltip, 'top', `${top}px`);
    this.renderer.setStyle(tooltip, 'left', `${left}px`);
    this.renderer.setStyle(tooltip, 'position', 'fixed');
    this.renderer.setStyle(tooltip, 'z-index', '9999');

    this.tooltipElement = tooltip;
  }

  private destroyTooltip() {
    if (this.tooltipElement) {
      this.renderer.removeChild(document.body, this.tooltipElement);
      this.tooltipElement = null;
    }
  }

  ngOnDestroy() {
    this.destroyTooltip();
  }
}
