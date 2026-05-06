"use client";
const FEEDBACK_WIDGET_SELECTOR = "[data-feedback-widget]";
const MAX_SCALE = 1;
const MAX_CAPTURE_DIMENSION = 16000;
const MAX_CAPTURE_PIXELS = 18000000;
const MIN_SCREENSHOT_DATA_URL_LENGTH = 3000;
const MAX_SCREENSHOT_DATA_URL_LENGTH = 6500000;
const JPEG_QUALITIES = [0.72, 0.58, 0.44, 0.32];
const UNSUPPORTED_COLOR_FUNCTION_PATTERN = /\b(?:lab|lch|oklab|oklch|color-mix)\(/i;
const FALLBACK_WIDTH = 1200;
const FALLBACK_HEIGHT = 800;
function waitForNextFrame() {
    return new Promise((resolve) => {
        window.requestAnimationFrame(() => resolve());
    });
}
function getSafeColor(value, fallback) {
    if (!value || value === "transparent" || value === "rgba(0, 0, 0, 0)") {
        return value || fallback;
    }
    if (!UNSUPPORTED_COLOR_FUNCTION_PATTERN.test(value)) {
        return value;
    }
    return fallback;
}
function sanitizeClonedColors(originalDocument, clonedDocument) {
    const safetyStyle = clonedDocument.createElement("style");
    safetyStyle.textContent = `
    *, *::before, *::after {
      accent-color: auto !important;
      background-image: none !important;
      border-color: rgb(71, 85, 105) !important;
      box-shadow: none !important;
      caret-color: rgb(226, 232, 240) !important;
      color: rgb(226, 232, 240) !important;
      column-rule-color: rgb(71, 85, 105) !important;
      fill: currentcolor !important;
      filter: none !important;
      outline-color: rgb(71, 85, 105) !important;
      stroke: currentcolor !important;
      text-decoration-color: rgb(226, 232, 240) !important;
      text-shadow: none !important;
    }

    svg {
      display: none !important;
    }
  `;
    clonedDocument.head.appendChild(safetyStyle);
    const originalElements = Array.from(originalDocument.querySelectorAll("*"));
    const clonedElements = Array.from(clonedDocument.querySelectorAll("*"));
    for (let index = 0; index < clonedElements.length; index += 1) {
        const originalElement = originalElements[index];
        const clonedElement = clonedElements[index];
        if (!originalElement || !clonedElement) {
            continue;
        }
        const styles = window.getComputedStyle(originalElement);
        const color = getSafeColor(styles.color, "#e5e7eb");
        const backgroundColor = getSafeColor(styles.backgroundColor, "transparent");
        const borderTopColor = getSafeColor(styles.borderTopColor, "#475569");
        const borderRightColor = getSafeColor(styles.borderRightColor, borderTopColor);
        const borderBottomColor = getSafeColor(styles.borderBottomColor, borderTopColor);
        const borderLeftColor = getSafeColor(styles.borderLeftColor, borderTopColor);
        const outlineColor = getSafeColor(styles.outlineColor, borderTopColor);
        const textDecorationColor = getSafeColor(styles.textDecorationColor, color);
        clonedElement.style.color = color;
        clonedElement.style.backgroundColor = backgroundColor;
        clonedElement.style.borderTopColor = borderTopColor;
        clonedElement.style.borderRightColor = borderRightColor;
        clonedElement.style.borderBottomColor = borderBottomColor;
        clonedElement.style.borderLeftColor = borderLeftColor;
        clonedElement.style.outlineColor = outlineColor;
        clonedElement.style.textDecorationColor = textDecorationColor;
        clonedElement.style.setProperty("accent-color", "auto");
        clonedElement.style.setProperty("background-image", "none");
        clonedElement.style.setProperty("caret-color", color);
        clonedElement.style.setProperty("column-rule-color", borderTopColor);
        clonedElement.style.setProperty("fill", "currentColor");
        clonedElement.style.setProperty("filter", "none");
        clonedElement.style.setProperty("stroke", "currentColor");
        if (UNSUPPORTED_COLOR_FUNCTION_PATTERN.test(styles.boxShadow)) {
            clonedElement.style.boxShadow = "none";
        }
        if (UNSUPPORTED_COLOR_FUNCTION_PATTERN.test(styles.textShadow)) {
            clonedElement.style.textShadow = "none";
        }
    }
}
function getFullPageDimensions() {
    const body = document.body;
    const documentElement = document.documentElement;
    const width = Math.ceil(Math.max(body.scrollWidth, body.offsetWidth, documentElement.clientWidth, documentElement.scrollWidth, documentElement.offsetWidth, window.innerWidth));
    const height = Math.ceil(Math.max(body.scrollHeight, body.offsetHeight, documentElement.clientHeight, documentElement.scrollHeight, documentElement.offsetHeight, window.innerHeight));
    const scaleLimitByDimension = Math.min(MAX_CAPTURE_DIMENSION / width, MAX_CAPTURE_DIMENSION / height);
    const scaleLimitByPixels = Math.sqrt(MAX_CAPTURE_PIXELS / Math.max(1, width * height));
    const scale = Math.max(0.25, Math.min(window.devicePixelRatio || 1, MAX_SCALE, scaleLimitByDimension, scaleLimitByPixels));
    return { height, scale, width };
}
async function runCapture(html2canvas, target, backgroundColor, dimensions) {
    return html2canvas(target, {
        allowTaint: false,
        backgroundColor,
        height: dimensions.height,
        ignoreElements: (element) => element instanceof HTMLElement && element.matches(FEEDBACK_WIDGET_SELECTOR),
        logging: false,
        onclone: (clonedDocument) => {
            if (clonedDocument.documentElement) {
                clonedDocument.documentElement.style.width = `${dimensions.width}px`;
                clonedDocument.documentElement.style.minHeight = `${dimensions.height}px`;
            }
            if (clonedDocument.body) {
                clonedDocument.body.style.width = `${dimensions.width}px`;
                clonedDocument.body.style.minHeight = `${dimensions.height}px`;
                clonedDocument.body.style.overflow = "visible";
            }
            sanitizeClonedColors(document, clonedDocument);
            clonedDocument.querySelectorAll(FEEDBACK_WIDGET_SELECTOR).forEach((element) => {
                element.remove();
            });
        },
        removeContainer: true,
        scale: dimensions.scale,
        scrollX: 0,
        scrollY: 0,
        useCORS: true,
        width: dimensions.width,
        windowHeight: dimensions.height,
        windowWidth: dimensions.width,
        x: 0,
        y: 0,
    });
}
function getBestDataUrl(canvas) {
    let fallback = null;
    for (const quality of JPEG_QUALITIES) {
        const dataUrl = canvas.toDataURL("image/jpeg", quality);
        if (dataUrl.length < MIN_SCREENSHOT_DATA_URL_LENGTH) {
            continue;
        }
        if (dataUrl.length <= MAX_SCREENSHOT_DATA_URL_LENGTH) {
            return dataUrl;
        }
        fallback = dataUrl;
    }
    return fallback;
}
async function runDomToImageCapture(backgroundColor, dimensions) {
    const { toJpeg } = await import("html-to-image");
    const target = document.body;
    for (const quality of JPEG_QUALITIES) {
        const dataUrl = await toJpeg(target, {
            backgroundColor,
            cacheBust: true,
            filter: (node) => !(node instanceof HTMLElement && node.matches(FEEDBACK_WIDGET_SELECTOR)),
            height: dimensions.height,
            pixelRatio: dimensions.scale,
            quality,
            skipAutoScale: true,
            style: {
                height: `${dimensions.height}px`,
                minHeight: `${dimensions.height}px`,
                overflow: "visible",
                width: `${dimensions.width}px`,
            },
            width: dimensions.width,
        });
        if (dataUrl.length < MIN_SCREENSHOT_DATA_URL_LENGTH) {
            continue;
        }
        if (dataUrl.length <= MAX_SCREENSHOT_DATA_URL_LENGTH) {
            return dataUrl;
        }
    }
    return null;
}
function isElementVisible(element) {
    const styles = window.getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return (styles.display !== "none" &&
        styles.visibility !== "hidden" &&
        Number(styles.opacity) > 0 &&
        rect.width > 0 &&
        rect.height > 0);
}
function getVisiblePageText() {
    const root = document.querySelector("main") ?? document.body;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const lines = [];
    while (walker.nextNode()) {
        const node = walker.currentNode;
        const parent = node.parentElement;
        const text = node.textContent?.replace(/\s+/g, " ").trim();
        if (!parent || !text || parent.closest(FEEDBACK_WIDGET_SELECTOR) || !isElementVisible(parent)) {
            continue;
        }
        if (!lines.includes(text)) {
            lines.push(text);
        }
        if (lines.length >= 28) {
            break;
        }
    }
    return lines;
}
function wrapText(context, text, maxWidth) {
    const words = text.split(" ");
    const lines = [];
    let currentLine = "";
    for (const word of words) {
        const testLine = currentLine ? `${currentLine} ${word}` : word;
        if (context.measureText(testLine).width <= maxWidth) {
            currentLine = testLine;
            continue;
        }
        if (currentLine) {
            lines.push(currentLine);
        }
        currentLine = word;
    }
    if (currentLine) {
        lines.push(currentLine);
    }
    return lines;
}
function buildFallbackScreenshot() {
    const canvas = document.createElement("canvas");
    canvas.width = FALLBACK_WIDTH;
    canvas.height = FALLBACK_HEIGHT;
    const context = canvas.getContext("2d");
    if (!context) {
        return null;
    }
    context.fillStyle = "#020617";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "#0f172a";
    context.fillRect(0, 0, canvas.width, 96);
    context.fillStyle = "#38bdf8";
    context.fillRect(0, 94, canvas.width, 2);
    context.fillStyle = "#f8fafc";
    context.font = "700 34px ui-sans-serif, system-ui, sans-serif";
    context.fillText("Feedback screenshot fallback", 44, 52);
    context.fillStyle = "#cbd5e1";
    context.font = "18px ui-sans-serif, system-ui, sans-serif";
    context.fillText("The browser could not render the live page with html2canvas, so page context was attached.", 44, 80);
    const metadata = [
        `URL: ${window.location.href}`,
        `Viewport: ${window.innerWidth}x${window.innerHeight}`,
        `Full page: ${getFullPageDimensions().width}x${getFullPageDimensions().height}`,
        `Screen: ${window.screen.width}x${window.screen.height}`,
        `Time: ${new Date().toLocaleString()}`,
    ];
    let y = 136;
    context.fillStyle = "#e2e8f0";
    context.font = "600 20px ui-sans-serif, system-ui, sans-serif";
    for (const item of metadata) {
        context.fillText(item, 44, y);
        y += 32;
    }
    y += 20;
    context.fillStyle = "#f8fafc";
    context.font = "700 24px ui-sans-serif, system-ui, sans-serif";
    context.fillText("Visible page text", 44, y);
    y += 36;
    context.fillStyle = "#cbd5e1";
    context.font = "18px ui-sans-serif, system-ui, sans-serif";
    const content = getVisiblePageText();
    const pageText = content.length > 0 ? content : ["No visible page text was detected."];
    for (const text of pageText) {
        const wrappedLines = wrapText(context, text, canvas.width - 88);
        for (const line of wrappedLines.slice(0, 2)) {
            if (y > canvas.height - 48) {
                return canvas.toDataURL("image/jpeg", 0.76);
            }
            context.fillText(line, 44, y);
            y += 26;
        }
        y += 8;
    }
    return canvas.toDataURL("image/jpeg", 0.76);
}
export async function captureScreenshot() {
    if (typeof window === "undefined" || typeof document === "undefined") {
        return null;
    }
    const widgetElements = Array.from(document.querySelectorAll(FEEDBACK_WIDGET_SELECTOR));
    const previousDisplay = new Map();
    const previousBodyOverflow = document.body.style.overflow;
    try {
        const { default: html2canvas } = await import("html2canvas");
        const backgroundColor = window.getComputedStyle(document.body).backgroundColor || "#ffffff";
        const dimensions = getFullPageDimensions();
        const targets = [
            document.documentElement,
            document.body,
            document.querySelector("main"),
        ].filter((target) => Boolean(target));
        for (const element of widgetElements) {
            previousDisplay.set(element, element.style.display);
            element.style.display = "none";
        }
        document.body.style.overflow = "visible";
        await waitForNextFrame();
        await waitForNextFrame();
        let bestScreenshot = null;
        try {
            const domToImageScreenshot = await runDomToImageCapture(backgroundColor, dimensions);
            if (domToImageScreenshot) {
                return domToImageScreenshot;
            }
        }
        catch (error) {
            console.warn("Feedback html-to-image capture failed.", error);
        }
        for (const target of targets) {
            try {
                const canvas = await runCapture(html2canvas, target, backgroundColor, dimensions);
                const screenshot = getBestDataUrl(canvas);
                if (!screenshot) {
                    continue;
                }
                if (screenshot.length <= MAX_SCREENSHOT_DATA_URL_LENGTH) {
                    return screenshot;
                }
                if (!bestScreenshot || screenshot.length < bestScreenshot.length) {
                    bestScreenshot = screenshot;
                }
            }
            catch (error) {
                console.warn("Feedback screenshot strategy failed.", error);
            }
        }
        return bestScreenshot ?? buildFallbackScreenshot();
    }
    catch (error) {
        console.warn("Feedback screenshot capture failed.", error);
        return buildFallbackScreenshot();
    }
    finally {
        document.body.style.overflow = previousBodyOverflow;
        for (const element of widgetElements) {
            element.style.display = previousDisplay.get(element) || "";
        }
    }
}
