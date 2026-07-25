import html2pdf from 'html2pdf.js';

/**
 * Helper utilities to sanitize CSS values and window.getComputedStyle
 * before html2canvas / html2pdf renders elements to PDF.
 * Converts unsupported CSS color functions like `oklch(...)` to standard RGB/RGBA strings.
 */

export function oklchToRgbStr(oklchMatch: string): string {
  try {
    const inner = oklchMatch.replace(/^oklch\(\s*/i, '').replace(/\s*\)$/, '');
    const [colorPart, alphaPart] = inner.split('/');
    
    const parts = colorPart.trim().split(/[\s,]+/);
    if (parts.length < 3) return 'rgb(240, 249, 255)';

    let L = parseFloat(parts[0]);
    if (parts[0].endsWith('%')) L /= 100;
    let C = parseFloat(parts[1]);
    if (parts[1].endsWith('%')) C /= 100;
    let H = parseFloat(parts[2]);

    if (isNaN(L)) L = 0;
    if (isNaN(C)) C = 0;
    if (isNaN(H)) H = 0;

    let alpha = 1;
    if (alphaPart) {
      const aStr = alphaPart.trim();
      if (aStr.endsWith('%')) {
        alpha = parseFloat(aStr) / 100;
      } else {
        alpha = parseFloat(aStr);
      }
      if (isNaN(alpha)) alpha = 1;
    }

    // OKLCH -> OKLAB
    const rad = (H * Math.PI) / 180;
    const a = C * Math.cos(rad);
    const b = C * Math.sin(rad);

    // OKLAB -> Linear LMS
    const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
    const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
    const s_ = L - 0.0894841775 * a - 1.2914855480 * b;

    const l = l_ * l_ * l_;
    const m = m_ * m_ * m_;
    const s = s_ * s_ * s_;

    // LMS -> Linear sRGB
    const rLin = +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
    const gLin = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
    const bLin = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s;

    // Gamma correction
    const gamma = (c: number) => {
      const abs = Math.abs(c);
      const corrected = abs <= 0.0031308 ? 12.92 * abs : 1.055 * Math.pow(abs, 1 / 2.4) - 0.055;
      return c < 0 ? -corrected : corrected;
    };

    const r = Math.round(Math.min(255, Math.max(0, gamma(rLin) * 255)));
    const g = Math.round(Math.min(255, Math.max(0, gamma(gLin) * 255)));
    const bVal = Math.round(Math.min(255, Math.max(0, gamma(bLin) * 255)));

    if (alpha < 1) {
      return `rgba(${r}, ${g}, ${bVal}, ${alpha.toFixed(3)})`;
    }
    return `rgb(${r}, ${g}, ${bVal})`;
  } catch {
    return 'rgb(240, 249, 255)';
  }
}

/**
 * Replaces nested color functions (oklch, oklab, color-mix, light-dark) with RGB/RGBA equivalents.
 * Uses paren-matching to correctly handle arbitrary nested parentheses.
 */
export function sanitizeCssValue(str: string): string {
  if (!str || typeof str !== 'string') return str;
  if (!/(oklch|oklab|color-mix|light-dark)/i.test(str)) return str;

  let result = '';
  let i = 0;
  const len = str.length;

  while (i < len) {
    const sub = str.slice(i);
    const match = sub.match(/^(oklch|oklab|color-mix|light-dark)\(/i);

    if (match) {
      const funcName = match[1].toLowerCase();
      const start = i;
      let depth = 0;
      let end = -1;

      for (let j = i + match[0].length - 1; j < len; j++) {
        if (str[j] === '(') depth++;
        else if (str[j] === ')') {
          depth--;
          if (depth === 0) {
            end = j;
            break;
          }
        }
      }

      if (end !== -1) {
        const fullExpr = str.slice(start, end + 1);
        let replacement = 'rgba(239, 246, 255, 0.8)';

        if (funcName === 'oklch') {
          replacement = oklchToRgbStr(fullExpr);
        } else if (funcName === 'color-mix') {
          const inner = fullExpr.slice(match[0].length, end);
          const cleanInner = sanitizeCssValue(inner);
          
          const rgbaM = cleanInner.match(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/);
          const rgbM = cleanInner.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
          const percMatch = cleanInner.match(/(\d+(?:\.\d+)?)%/);
          const hasTransparent = /transparent/i.test(cleanInner);

          if (rgbaM) {
            let a = parseFloat(rgbaM[4]);
            if (percMatch && hasTransparent) {
              a = (parseFloat(percMatch[1]) / 100) * a;
            }
            replacement = `rgba(${rgbaM[1]}, ${rgbaM[2]}, ${rgbaM[3]}, ${a.toFixed(2)})`;
          } else if (rgbM) {
            if (hasTransparent) {
              let a = 0.5;
              if (percMatch) {
                a = parseFloat(percMatch[1]) / 100;
              }
              replacement = `rgba(${rgbM[1]}, ${rgbM[2]}, ${rgbM[3]}, ${a.toFixed(2)})`;
            } else {
              replacement = `rgb(${rgbM[1]}, ${rgbM[2]}, ${rgbM[3]})`;
            }
          } else {
            replacement = 'rgba(239, 246, 255, 0.9)';
          }
        } else if (funcName === 'light-dark') {
          const inner = fullExpr.slice(match[0].length, end);
          const parts = inner.split(',');
          if (parts.length >= 1) {
            replacement = sanitizeCssValue(parts[0].trim());
          }
        }

        result += replacement;
        i = end + 1;
        continue;
      }
    }

    result += str[i];
    i++;
  }

  // Fallback regex cleanup if any orphaned tokens exist - default to light transparent or transparent
  if (/(oklch|oklab|color-mix|light-dark)/i.test(result)) {
    result = result.replace(/:\s*[^;}]*(oklch|oklab|color-mix|light-dark)[^;}]*/gi, ': transparent');
    result = result.replace(/oklch\([^)]*\)/gi, 'rgba(239, 246, 255, 0.9)');
    result = result.replace(/oklab\([^)]*\)/gi, 'rgba(239, 246, 255, 0.9)');
    result = result.replace(/color-mix\([^)]*\)/gi, 'rgba(239, 246, 255, 0.9)');
    result = result.replace(/light-dark\([^)]*\)/gi, 'inherit');
    result = result.replace(/\b(oklch|oklab|color-mix|light-dark)\b[^;\}"]*/gi, 'transparent');
  }

  return result;
}

/**
 * Pre-converts all <img> elements in container to inline data URIs so html2canvas renders them with zero CORS issues.
 */
export function convertImagesToDataUris(container: HTMLElement): Promise<void> {
  const images = Array.from(container.querySelectorAll('img'));
  if (images.length === 0) return Promise.resolve();

  const promises = images.map((img) => {
    return new Promise<void>((resolve) => {
      if (!img.src || img.src.startsWith('data:')) {
        resolve();
        return;
      }
      const image = new Image();
      image.crossOrigin = 'anonymous';
      image.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = image.naturalWidth || image.width || 100;
          canvas.height = image.naturalHeight || image.height || 100;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(image, 0, 0);
            const dataUrl = canvas.toDataURL('image/png');
            if (dataUrl && dataUrl.length > 50) {
              img.src = dataUrl;
            }
          }
        } catch {
          // Ignore CORS error, keep existing src
        }
        resolve();
      };
      image.onerror = () => resolve();
      image.src = img.src;
    });
  });

  return Promise.all(promises).then(() => undefined);
}

/**
 * Inlines computed styles as explicit RGB values on source DOM elements.
 * Returns a function to restore original inline style attributes.
 */
export function applyInlineSanitizedStyles(sourceElement: HTMLElement): () => void {
  const elements = [sourceElement, ...Array.from(sourceElement.querySelectorAll<HTMLElement>('*'))];
  const originalStyles = new Map<HTMLElement, string | null>();

  const colorProps = [
    'color',
    'background-color',
    'border-color',
    'border-top-color',
    'border-right-color',
    'border-bottom-color',
    'border-left-color',
    'outline-color',
    'fill',
    'stroke',
    'box-shadow',
    'text-shadow'
  ];

  elements.forEach((el) => {
    originalStyles.set(el, el.getAttribute('style'));
    try {
      const cs = window.getComputedStyle(el);
      colorProps.forEach((prop) => {
        const val = cs.getPropertyValue(prop);
        if (val && /(oklch|oklab|color-mix|light-dark)/i.test(val)) {
          const cleanVal = sanitizeCssValue(val);
          el.style.setProperty(prop, cleanVal, 'important');
        }
      });

      const styleAttr = el.getAttribute('style');
      if (styleAttr && /(oklch|oklab|color-mix|light-dark)/i.test(styleAttr)) {
        el.setAttribute('style', sanitizeCssValue(styleAttr));
      }
    } catch {
      // Ignore
    }
  });

  return () => {
    elements.forEach((el) => {
      const orig = originalStyles.get(el);
      if (orig !== null && orig !== undefined) {
        el.setAttribute('style', orig);
      } else {
        el.removeAttribute('style');
      }
    });
  };
}

export function prepareClonedDocForPdf(
  clonedDoc: Document,
  sourceElement: HTMLElement,
  targetId: string
) {
  // 1. Hide print:hidden elements
  clonedDoc.querySelectorAll('.print\\:hidden, [data-html2canvas-ignore]').forEach((el) => {
    (el as HTMLElement).style.display = 'none';
  });

  const target = (clonedDoc.getElementById(targetId) ||
    clonedDoc.querySelector(`[id="${targetId}"]`) ||
    clonedDoc.querySelector('[id*="printable"]') ||
    clonedDoc.body.firstElementChild ||
    clonedDoc.body) as HTMLElement;

  if (!target) return;

  // 2. Format container for pristine PDF layout matching modal
  target.style.display = 'block';
  target.style.position = 'relative';
  target.style.top = '0';
  target.style.left = '0';
  target.style.width = '794px'; // Standard A4 width at 96 DPI
  target.style.maxWidth = '794px';
  target.style.margin = '0 auto';
  target.style.backgroundColor = '#ffffff';
  target.style.color = '#0f172a';
  target.style.padding = '20px';
  target.style.boxSizing = 'border-box';
  target.style.maxHeight = 'none';
  target.style.height = 'auto';
  target.style.overflow = 'visible';

  if (clonedDoc.body) {
    clonedDoc.body.style.backgroundColor = '#ffffff';
    clonedDoc.body.style.margin = '0';
    clonedDoc.body.style.padding = '0';
    clonedDoc.body.style.overflow = 'visible';
  }

  let current: HTMLElement | null = target.parentElement;
  while (current && current !== clonedDoc.body) {
    current.style.overflow = 'visible';
    current.style.maxHeight = 'none';
    current.style.height = 'auto';
    current.style.position = 'static';
    current.style.display = 'block';
    current = current.parentElement;
  }

  // 3. Override getComputedStyle on clonedWindow
  const clonedWindow = clonedDoc.defaultView || window;
  if (clonedWindow && clonedWindow.getComputedStyle) {
    const origGetComputedStyle = clonedWindow.getComputedStyle.bind(clonedWindow);
    clonedWindow.getComputedStyle = function (elt: Element, pseudoElt?: string | null) {
      const realStyle = origGetComputedStyle(elt, pseudoElt);
      return new Proxy(realStyle, {
        get(targetObj, prop) {
          if (prop === 'getPropertyValue') {
            return (propertyName: string) => {
              const val = targetObj.getPropertyValue(propertyName);
              return sanitizeCssValue(val);
            };
          }
          const val = (targetObj as any)[prop];
          if (typeof val === 'string') {
            return sanitizeCssValue(val);
          }
          if (typeof val === 'function') {
            return val.bind(targetObj);
          }
          return val;
        }
      });
    };
  }

  // 4. Sanitize all style attributes and inline styles in clonedDoc
  const allClonedEls = Array.from(target.querySelectorAll<HTMLElement>('*'));
  allClonedEls.forEach((el) => {
    el.style.maxHeight = 'none';
    el.style.overflow = 'visible';

    const styleAttr = el.getAttribute('style');
    if (styleAttr && /(oklch|oklab|color-mix|light-dark)/i.test(styleAttr)) {
      el.setAttribute('style', sanitizeCssValue(styleAttr));
    }
  });
}

/**
 * Universal safe export function for downloading PDFs without OKLCH or CORS errors.
 */
export async function exportElementToPdf(
  sourceElement: HTMLElement,
  filename: string,
  targetId: string
) {
  if (!sourceElement) return;

  // 1. Convert images to inline data URIs
  await convertImagesToDataUris(sourceElement);

  // 2. Inlining computed RGB/RGBA values into elements
  const restoreInlineStyles = applyInlineSanitizedStyles(sourceElement);

  // 3. Backup and patch globals during pdf export
  const origGetPropertyValue = CSSStyleDeclaration.prototype.getPropertyValue;
  const origGetComputedStyle = window.getComputedStyle;

  let styleSheetsDescriptor: PropertyDescriptor | undefined;
  try {
    styleSheetsDescriptor = Object.getOwnPropertyDescriptor(Document.prototype, 'styleSheets');
  } catch {
    // Ignore
  }

  try {
    // Intercept CSSStyleDeclaration.prototype.getPropertyValue
    CSSStyleDeclaration.prototype.getPropertyValue = function (prop: string) {
      const val = origGetPropertyValue.call(this, prop);
      return sanitizeCssValue(val);
    };

    // Intercept window.getComputedStyle
    window.getComputedStyle = function (elt: Element, pseudoElt?: string | null) {
      const realStyle = origGetComputedStyle.call(window, elt, pseudoElt);
      return new Proxy(realStyle, {
        get(targetObj, prop) {
          if (prop === 'getPropertyValue') {
            return (propertyName: string) => {
              const val = targetObj.getPropertyValue(propertyName);
              return sanitizeCssValue(val);
            };
          }
          const val = (targetObj as any)[prop];
          if (typeof val === 'string') {
            return sanitizeCssValue(val);
          }
          if (typeof val === 'function') {
            return val.bind(targetObj);
          }
          return val;
        }
      });
    };

    // Intercept document.styleSheets
    try {
      Object.defineProperty(Document.prototype, 'styleSheets', {
        get() {
          return [] as any;
        },
        configurable: true
      });
    } catch {
      // Ignore
    }

    const html2pdfFunc = (html2pdf as any)?.default || (html2pdf as any);

    const opt = {
      margin:       [4, 4, 4, 4] as [number, number, number, number],
      filename,
      image:        { type: 'jpeg' as const, quality: 0.98 },
      html2canvas:  { 
        scale: 2, 
        useCORS: true, 
        allowTaint: true,
        logging: false, 
        scrollY: 0,
        scrollX: 0,
        windowWidth: 850,
        onclone: (clonedDoc: Document) => {
          if (sourceElement) {
            prepareClonedDocForPdf(clonedDoc, sourceElement, targetId);
          }
        }
      },
      jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' as const }
    };

    if (typeof html2pdfFunc === 'function') {
      const worker = html2pdfFunc().set(opt).from(sourceElement);
      await worker.save();
    } else {
      window.print();
    }
  } finally {
    // Restore globals
    CSSStyleDeclaration.prototype.getPropertyValue = origGetPropertyValue;
    window.getComputedStyle = origGetComputedStyle;

    if (styleSheetsDescriptor) {
      try {
        Object.defineProperty(Document.prototype, 'styleSheets', styleSheetsDescriptor);
      } catch {
        // Ignore
      }
    }

    restoreInlineStyles();
  }
}
