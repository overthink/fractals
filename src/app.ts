type Margin = {top: number; right: number; bottom: number; left: number};

/** Return the viewport size in pixels: width, height. */
function viewportSize(): [number, number] {
    const de = document.documentElement;
    const width = Math.max(de.clientWidth, window.innerWidth || 0);
    const height = Math.max(de.clientHeight, window.innerHeight || 0);
    return [width, height];
}

/**
 * Return the element from the page that will hold the canvas.
 */
function getCanvasContainer(): HTMLElement {
    const id = "#canvas-container";
    const container = document.querySelector(id);
    if (!container || !(container instanceof HTMLElement)) {
        throw new Error(`no HTMLElement found with selector ${id}`);
    }
    return container;
}

/**
 * Style container to take up the whole viewport, with given margins and
 * border thickness.
 */
function styleCanvasContainer(
        container: HTMLElement,
        width: number,
        height: number,
        margin: Margin,
        borderStyle: string): Element {
    const s = container.style;
    s.width = width.toString() + "px";
    s.height = height.toString() + "px";
    s.marginTop = margin.top + "px";
    s.marginRight = margin.right + "px";
    s.marginBottom = margin.bottom + "px";
    s.marginLeft = margin.left + "px";
    s.border = borderStyle;
    // Need to explicitly position this container so the child canvas elements
    // can be positioned absolute.
    s.position = "relative";
    return container;
}

/**
 * Return [width, height] values to use for the canvas, given margin and border
 * constraints.
 */
function calcCanvasDims(margin: Margin, borderThickness: number): [number, number] {
    const [viewportW, viewportH] = viewportSize();
    const canvasW = viewportW - margin.left - margin.right - 2 * borderThickness;
    const canvasH = viewportH - margin.top - margin.bottom - 2 * borderThickness;
    return [canvasW, canvasH];
}

/**
 * Return the number of pixels per unit length in the complex plane. This just
 * ensures our default zoom level includes the entire Mandlebrot set.
 *
 * Reminder, Mandelbrot fits in Re (-2.5, 1) and Im (-1, 1).
 */
function getInitialScale(canvasW: number, canvasH: number): number {
    if (canvasW / canvasH >= (3.5 / 2)) {
        return canvasH / 2;
    }
    return canvasW / 3.5;
}

const enum Colour {
    R = 0, G, B, A
}

/**
 * Draw a view of the Mandlebrot set starting from (topLeftX, topLeftY) on the
 * complex plane. 'scale' determines the number of pixels per unit of length
 * on the complex plane.
 */
function drawMandlebrot(
        context: CanvasRenderingContext2D,
        renderState: RenderState): void {
    const start = Date.now();
    const canvasW = context.canvas.width;
    const canvasH = context.canvas.height;
    const imageData = context.getImageData(0, 0, canvasW, canvasH);
    const data: Uint8ClampedArray = imageData.data;
    console.log(`Need to draw ${data.length / 4} pixels`);

    // let z[0] = 0 and c be an arbitrary complex number
    // then c is in the Mandelbrot set if |z[n]| remains bounded for
    // arbitrarily large n in z[n+1] = z[n]^2 + c

    // differently, P[c] is a complex polynomial (fn):
    // P[c](z) = z^2 + c (think of c as x,y coords on a canvas)
    // c is in the set if the sequence P[c](0), P[c](P[c](0)),
    // P[c](P[c](P[c](0))), ... remains bounded in absolute value.

    for (let i = 0; i < data.length; i += 4) {
        const pixelNum  = i / 4;
        const pixelX = pixelNum % canvasW;
        const pixelY = Math.floor(pixelNum / canvasW);
        const x0 = pixelX / renderState.scale + renderState.topLeft.re;
        const y0 = pixelY / renderState.scale - renderState.topLeft.im;

        let x = 0;
        let y = 0;

        // any point surviving till maxIterations is in the set
        let iteration = 0;
        let maxIterations = 10000;
        while (x * x + y * y < 2 * 2 && iteration < maxIterations) {
            const xTemp = x * x - y * y + x0;
            y = 2 * x * y + y0;
            x = xTemp;
            iteration++;
        }

        data[i + Colour.R] = 0;
        data[i + Colour.G] = 0;
        data[i + Colour.B] = iteration % 255; //iteration == maxIterations ? 255 : 0;
        data[i + Colour.A] = 255;
    }
    context.putImageData(imageData, 0, 0);
    console.log(`drawMandlebrot() ran in ${Date.now() - start} ms`);
}

function getMouseCoords(canvas: HTMLCanvasElement, e: MouseEvent): [number, number] {
    const rect = canvas.getBoundingClientRect();
    return [e.clientX - rect.left, e.clientY - rect.top];
}

/**
 * A canvas element with a second transparent canvas element (the "overlay")
 * positioned right on top of it.
 */
class OverlayCanvas {

    readonly width: number;
    readonly height: number;
    readonly background: HTMLCanvasElement;
    readonly overlay: HTMLCanvasElement;
    readonly backgroundCtx: CanvasRenderingContext2D;
    readonly overlayCtx: CanvasRenderingContext2D;

    constructor(width: number, height: number) {
        this.width = width;
        this.height = height;
        this.background = OverlayCanvas.styleCanvas(OverlayCanvas.createCanvas(width, height), 1);
        this.overlay = OverlayCanvas.styleCanvas(OverlayCanvas.createCanvas(width, height), 2);
        this.backgroundCtx = OverlayCanvas.get2DContext(this.background);
        this.overlayCtx = OverlayCanvas.get2DContext(this.overlay);
    }

    private static get2DContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
        const ctx = canvas.getContext("2d");
        if (!ctx) {
            throw new Error(`Could not get 2d context for ${canvas}`);
        }
        return ctx;
    }

    private static styleCanvas(canvas: HTMLCanvasElement, zIndex: number): HTMLCanvasElement {
        const s = canvas.style;
        s.position = "absolute";
        s.left = "0px";
        s.top = "0px";
        s.zIndex = zIndex.toString();
        return canvas;
    }

    private static disableScrollbars(canvas: HTMLCanvasElement): HTMLCanvasElement {
        // canvas is display:inline(-block?) by default, apparently
        // display:block prevents scrollbars; don't fully get it.
        // http://stackoverflow.com/a/8486324/69689
        canvas.style.display = "block";
        return canvas;
    }

    private static createCanvas(width: number, height: number): HTMLCanvasElement {
        const canvas = document.createElement("canvas");
        // Don't use CSS to set width/height, see: http://stackoverflow.com/a/12862952/69689
        canvas.setAttribute("width", width.toString());
        canvas.setAttribute("height", height.toString());
        return OverlayCanvas.disableScrollbars(canvas);
    }

    appendTo(element: Element): void {
        element.appendChild(this.background);
        element.appendChild(this.overlay);
    }

    clearOverlay(): void {
        this.overlayCtx.clearRect(0, 0, this.width, this.height);
    }

    /** Clear both canvases. */
    clear(): void {
        this.backgroundCtx.clearRect(0, 0, this.width, this.height);
        this.overlayCtx.clearRect(0, 0, this.width, this.height);
    }

}

interface RenderState {
    /** Top left corner of the view onto the complex plane. */
    topLeft: Complex,
    /** scale is pixels per unit on the complex plane. */
    scale: number
}

function clearRenderState(): void {
    window.location.href = "";
}

function saveRenderState(state: RenderState): void {
    window.location.href = `#re=${state.topLeft.re}&im=${state.topLeft.im}&scale=${state.scale}`;
}

function loadRenderState(): RenderState | undefined {
    const fragment = window.location.hash;
    if (fragment.trim().length == 0) {
        return;
    }
    const parsed = fragment
        .replace(/^#/, "")
        .split("&")
        .map(x => x.split("="))
        .reduce((acc, [k, v]) => {
            acc[k] = parseFloat(v);
            return acc;
        }, {} as {[k: string]: number});
    return {
        scale: parsed["scale"],
        topLeft: {re: parsed["re"], im: parsed["im"]}
    }
}

/** Create a reset zoom button, add to DOM and return it. */
function addResetButton(margin: Margin): HTMLButtonElement {
    const button = document.createElement("button");
    button.innerText = "Reset zoom";
    const s = button.style;
    s.position = "fixed";
    s.left = `${margin.left}px`;
    s.bottom = `15px`;
    document.body.appendChild(button);
    return button;
}

/** Returns a render state that shows the full Mandelbrot set. */
function defaultRenderState(canvasW: number, canvasH: number): RenderState {
    const scale = getInitialScale(canvasW, canvasH);
    return {
        scale: scale,
        topLeft: {
            re: -2.5 - (canvasW / scale - (1 - -2.5)) / 2,
            im: 1 + (canvasH / scale - (1 - -1)) / 2
        }
    }
}

/** Very basic complex number class. */
class Complex {
    constructor(public re: number, public im: number) {}
}

function addListeners(element: HTMLElement, eventTypes: string[], el: EventListenerOrEventListenerObject): HTMLElement {
    for (let et of eventTypes) {
        element.addEventListener(et, el);
    }
    return element;
}

/** Convert a touch event to a mouse event. */
function touchToMouse(mouseEventName: string, e: TouchEvent): MouseEvent {
    e.preventDefault();
    e.stopPropagation();
    if (mouseEventName == "mouseup") {
        return new MouseEvent(mouseEventName, {
            clientX: e.changedTouches[0].clientX,
            clientY: e.changedTouches[0].clientY
        });
    } else {
        return new MouseEvent(mouseEventName, {
            clientX: e.touches[0].clientX,
            clientY: e.touches[0].clientY
        });
    }
}

function main(): void {

    const margin = {top: 50, right: 50, bottom: 50, left: 50};
    const borderThickness = 1;
    const [canvasW, canvasH] = calcCanvasDims(margin, borderThickness);
    const container: Element = styleCanvasContainer(
        getCanvasContainer(),
        canvasW,
        canvasH,
        margin,
        `${borderThickness}px solid #333`);

    const canvases = new OverlayCanvas(canvasW, canvasH);
    canvases.appendTo(container);

    const renderState = loadRenderState() || defaultRenderState(canvasW, canvasH);
    let mouseDownCanvasX = 0;
    let mouseDownCanvasY = 0;
    let dragging = false;

    const draw = () => {
        if (!(isFinite(renderState.scale) &&
            isFinite(renderState.topLeft.re) &&
            isFinite(renderState.topLeft.im))) {
            return;
        }
        window.document.body.style.cursor = "progress";
        canvases.clear();
        // Wait a couple ms before big number crunching to let the browser update UI.
        setTimeout(() => {
            drawMandlebrot(canvases.backgroundCtx, renderState);
            window.document.body.style.cursor = "default";
            saveRenderState(renderState);
        }, 50);
    };

    addResetButton(margin).addEventListener("click", () => {
        clearRenderState();
        draw();
    });

    addListeners(canvases.overlay, ["mousedown", "touchstart"], e => {
        let me = e as MouseEvent;
        if (e instanceof TouchEvent) {
            me = touchToMouse("mousedown", e);
        }
        const [x, y] = getMouseCoords(canvases.overlay, me);
        mouseDownCanvasX = x;
        mouseDownCanvasY = y;
        dragging = true;
    });

    addListeners(canvases.overlay, ["mouseup", "touchend"], e => {
        let me = e as MouseEvent;
        if (e instanceof TouchEvent) {
            me = touchToMouse("mouseup", e);
        }
        dragging = false;
        const x0 = mouseDownCanvasX / renderState.scale + renderState.topLeft.re;
        const y0 = mouseDownCanvasY / -renderState.scale + renderState.topLeft.im;
        renderState.topLeft.re = x0;
        renderState.topLeft.im = y0;
        // now use the mouseup coordinates to figure out new scale
        const [x, _] = getMouseCoords(canvases.overlay, me);
        renderState.scale = canvasW / ((x - mouseDownCanvasX) / renderState.scale);
        canvases.clearOverlay();
        draw();
    });

    addListeners(canvases.overlay, ["mousemove", "touchmove"], e => {
        let me = e as MouseEvent;
        if (e instanceof TouchEvent) {
            me = touchToMouse("mousemove", e);
        }
        if (dragging) {
            canvases.clearOverlay();
            const [x, y] = getMouseCoords(canvases.overlay, me);
            const c = canvases.overlayCtx;
            c.strokeStyle = "grey";
            c.setLineDash([6]);
            c.strokeRect(
                mouseDownCanvasX,
                mouseDownCanvasY,
                x - mouseDownCanvasX,
                y - mouseDownCanvasY);
        }
    });

    draw();
}

main();
