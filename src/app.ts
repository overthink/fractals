type Margin = {top: number; right: number; bottom: number; left: number};

function disableScrollbars(canvas: HTMLCanvasElement): void {
    // canvas is display:inline(-block?) by default, apparently
    // display:block prevents scrollbars; don't fully get it.
    // http://stackoverflow.com/a/8486324/69689
    canvas.style.display = "block";
}

/** Return a new canvas with given width, height, and margin. */
function createCanvas(width: number, height: number): HTMLCanvasElement {
    const canvas = document.createElement("canvas");
    // Don't use CSS to set width/height, see: http://stackoverflow.com/a/12862952/69689
    canvas.setAttribute("width", width.toString());
    canvas.setAttribute("height", height.toString());
    disableScrollbars(canvas);
    return canvas;
}

/** Return the viewport size in pixels: width, height. */
function viewportSize(): [number, number] {
    const de = document.documentElement;
    const width = Math.max(de.clientWidth, window.innerWidth || 0);
    const height = Math.max(de.clientHeight, window.innerHeight || 0);
    return [width, height];
}

/**
 * Return the element from the page that will hold the canvas. The returned
 * element is styled to take up the whole viewport, with given margins and
 * border thickness.
 */
function getCanvasContainer(margin: Margin, borderStyle: string): Element {
    const id = "#canvas-container";
    const container = document.querySelector(id);
    if (!container || !(container instanceof HTMLElement)) {
        throw new Error(`no HTMLElement found with selector ${id}`);
    }
    const s = container.style;
    s.marginTop = margin.top + "px";
    s.marginRight = margin.right + "px";
    s.marginBottom = margin.bottom + "px";
    s.marginLeft = margin.left + "px";
    s.border = borderStyle;
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
        scale: number,
        topLeftX: number,
        topLeftY: number): void {
    const start = Date.now();
    const canvasW = context.canvas.width;
    const canvasH = context.canvas.height;
    const imageData = context.getImageData(0, 0, canvasW, canvasH);
    const data: Uint8ClampedArray = imageData.data;
    console.log(`Need to draw ${data.length / 4} pixels`);

    // let z[0] = 0
    // then c is in the set if |z[n]| remains bounded for arbitrarily large n in
    // z[n+1] = z[n]^2 + c

    // differently, P[c] is a complex polynomial (fn):
    // P[c](z) = z^2 + c (think of c as x,y coords on a canvas)
    // c is in the set if the sequence P[c](0), P[c](P[c](0)),
    // P[c](P[c](P[c](0))), ... remains bounded in absolute value.

    for (let i = 0; i < data.length; i += 4) {
        const pixelNum  = i / 4;
        const pixelX = pixelNum % canvasW;
        const pixelY = Math.floor(pixelNum / canvasW);
        const x0 = pixelX / scale + topLeftX;
        const y0 = pixelY / scale - topLeftY;

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
    return [e.x - rect.left, e.y - rect.top];
}

function main(): void {
    const margin = {top: 50, right: 50, bottom: 50, left: 50};
    const borderThickness = 1;
    const [canvasW, canvasH] = calcCanvasDims(margin, borderThickness);
    const containerElement = getCanvasContainer(margin, `${borderThickness}px solid #333`);

    const canvas = createCanvas(canvasW, canvasH);
    containerElement.appendChild(canvas);

    const context = canvas.getContext("2d");
    if (!context) {
        throw new Error("Couldn't get 2d drawing context");
    }

    // "unit" being distance 1 on complex plane
    let pixelsPerUnit: number = getInitialScale(canvasW, canvasH);

    // ugliness to centre our view of the complex plane (re [-2.5, 1], im
    // [-1, 1]) in the canvas
    let topLeftX = -2.5 - (canvasW / pixelsPerUnit - (1 - -2.5)) / 2;
    let topLeftY = 1 + (canvasH / pixelsPerUnit - (1 - -1)) / 2;


    let mouseDownCanvasX = 0;
    let mouseDownCanvasY = 0;

    const draw = () => {
        console.log(canvasW, canvasH, pixelsPerUnit, topLeftX, topLeftY);
        drawMandlebrot(context, pixelsPerUnit, topLeftX, topLeftY);
    };

    canvas.addEventListener("mousedown", e => {
        const [x, y] = getMouseCoords(canvas, e);
        mouseDownCanvasX = x;
        mouseDownCanvasY = y;
    });

    canvas.addEventListener("mouseup", e => {
        const x0 = mouseDownCanvasX / pixelsPerUnit + topLeftX;
        const y0 = mouseDownCanvasY / -pixelsPerUnit + topLeftY;
        console.log("clicked down on", x0, y0, "(complex plane coordinates)");
        topLeftX = x0;
        topLeftY = y0;
        // now use the mouseup coordinates to figure out new scale
        const [x, y] = getMouseCoords(canvas, e);
        console.log("mouseup", mouseDownCanvasX, mouseDownCanvasY, x, y, pixelsPerUnit, (x - mouseDownCanvasX));
        pixelsPerUnit = canvasW / ((x - mouseDownCanvasX) / pixelsPerUnit);
        console.log("new ppu", pixelsPerUnit);
        draw();
    });

    draw();
}

main();
