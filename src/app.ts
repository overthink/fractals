import * as PIXI from "pixi.js";
import Stage = PIXI.core.Stage;
import Graphics = PIXI.Graphics;

type Margin = {top: number; right: number; bottom: number; left: number};

class Vec2 {
    constructor(readonly x: number, readonly y: number) {}
}

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
 * Apply f to args, then take the result of that and apply f to it again. Do
 * this n times.
 */
function iterate<T>(f: (a: T) => T, args: T, n: number) {
    let result = args;
    while (n > 0) {
        result = f.call(null, result);
        n--;
    }
    return result;
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

/**
 * Draw a view of the Mandlebrot set starting from (topLeftX, topLeftY) on the
 * complex plane. 'scale' determines the number of pixels per unit of length
 * on the complex plane.
 */
function drawMandlebrot(
        context: CanvasRenderingContext2D,
        canvasW: number,
        canvasH: number,
        scale: number,
        topLeftX: number,
        topLeftY: number): void {

    const imageData = context.getImageData(0, 0, canvasW, canvasH);
    const data: Uint8ClampedArray = imageData.data;
    console.log(`Need to draw ${data.length / 4} pixels`);

    for (let i = 0; i < data.length; i += 4) {
        const pixelNum  = i / 4;
        const pixelX = pixelNum % canvasW;
        const pixelY = Math.floor(pixelNum / canvasW);
        const x0 = pixelX / scale + topLeftX;
        const y0 = pixelY / scale - topLeftY;

        let x = 0;
        let y = 0;
        let iteration = 0;
        let maxIterations = 10000;
        while (x * x + y * y < 2 * 2 && iteration < maxIterations) {
            const xTemp = x * x - y * y + x0;
            y = 2 * x * y + y0;
            x = xTemp;
            iteration++;
        }

        data[i] = 0;
        data[i + 1] = 0;
        data[i + 2] = iteration % 255;
    }
    context.putImageData(imageData, 0, 0);

}

function main(): void {
    const start = Date.now();
    const margin = {top: 50, right: 50, bottom: 50, left: 50};
    const borderThickness = 1;
    const [canvasW, canvasH] = calcCanvasDims(margin, borderThickness);
    const renderer = new PIXI.CanvasRenderer(canvasW, canvasH);
    const containerElement = getCanvasContainer(margin, `${borderThickness}px solid #333`);
    disableScrollbars(renderer.view);
    containerElement.appendChild(renderer.view);

    // TODO: going to bypass Pixi, so get rid of it
    const context = renderer.view.getContext("2d");
    if (!context) throw new Error("Couldn't get 2d drawing context");

    let pixelsPerUnit: number = getInitialScale(canvasW, canvasH);
    drawMandlebrot(context, canvasW, canvasH, pixelsPerUnit, -2.5, 1);

    // const draw = () => {
    //     g.clear();
    //     renderer.render(stage);
    //     requestAnimationFrame(draw);
    // };
    // requestAnimationFrame(draw);

    console.log(`main() ran in ${Date.now() - start} ms`);
}

main();
