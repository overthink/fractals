import * as PIXI from "pixi.js";
import Stage = PIXI.core.Stage;
import Graphics = PIXI.Graphics;

type Margin = {top: number; right: number; bottom: number; left: number};

function cssColourToNum(cssColour: string): number {
    return parseInt(cssColour.substr(1), 16);
}

const Red = "#d50081";
const Blue = "#0e73ba";
const RedHex = cssColourToNum(Red);
const BlueHex = cssColourToNum(Blue);

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

function drawP2Triangle(context: CanvasRenderingContext2D, t: Triangle): void {
    // Assume this:
    //      A
    //     /ϴ\
    //    /   \
    //   B_____C
    const isRed = t.colour == Red;

    if (!isRed) {
        // stroke BC in the fill colour to avoid seams... gah, lame solution
        const origStrokeStyle = context.strokeStyle;
        context.beginPath();
        context.moveTo(t.b.x, t.b.y);
        context.lineTo(t.c.x, t.c.y);
        context.strokeStyle = t.colour;
        context.stroke();
        context.strokeStyle = origStrokeStyle;
    }

    context.beginPath();
    context.moveTo(t.b.x, t.b.y);
    context.lineTo(t.a.x, t.a.y);
    context.lineTo(t.c.x, t.c.y);
    // background is already red, so no need to re-fill it as red
    if (!isRed) {
        context.fillStyle = t.colour;
        context.fill();
    }
    context.stroke();
}

function drawP2TrianglePixi(g: Graphics, t: Triangle): void {
    // Assume this:
    //      A
    //     /ϴ\
    //    /   \
    //   B_____C
    const isRed = t.colour == Red;
    if (!isRed) {
        g.beginFill(BlueHex);
    }
    g.moveTo(t.b.x, t.b.y);
    g.lineTo(t.a.x, t.a.y);
    g.lineTo(t.c.x, t.c.y);
    if (!isRed) {
        g.endFill();
    }
}

function deflate(t: Triangle): Triangle[] {
    const result: Triangle[] = [];
    if (t.colour == Red) {
        const ab = t.b.copy().subtract(t.a); // vector from a to b
        const p = t.a.copy().add(ab.copy().normalize().multiply(ab.magnitude() / Phi));
        result.push(
            new Triangle(t.c, p, t.b, Red),
            new Triangle(p, t.c, t.a, Blue)
        );
    } else {
        const ba = t.a.copy().subtract(t.b); // vector from b to a
        const bc = t.c.copy().subtract(t.b); // vector from b to c
        const q = t.b.copy().add(ba.copy().normalize().multiply(ba.magnitude() / Phi));
        const r = t.b.copy().add(bc.copy().normalize().multiply(bc.magnitude() / Phi));
        result.push(
            new Triangle(q, r, t.b, Blue),
            new Triangle(r, q, t.a, Red),
            new Triangle(r, t.c, t.a, Blue)
        );
    }

    return result;
}

function deflateMany(ts: Triangle[]): Triangle[] {
    const result: Triangle[] = [];
    ts.map(deflate).forEach(ts0 => ts0.forEach(t => result.push(t)));
    return result;
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

function generateP2Tiling(width: number, height: number, iterations: number): Triangle[] {
    const triangles: Triangle[] = [];
    const centre = new Vec2(width / 2, height / 2);
    const sideLen = Math.max(width, height) / 2 * 1.4;

    // Generating a "wheel" of triangles about the origin.
    // start is the point from which we start rotating
    let start = new Vec2(centre.x, centre.y + sideLen);
    for (let i = 0; i < 10; ++i) {
        const b = start.copy();
        const c = start.copy().rotate(2 * Math.PI / 10, centre);
        let t = new Triangle(centre, b, c, Red);
        start = t.c.copy();
        // mirror every other triangle
        if (i % 2 == 0) {
            t = new Triangle(centre, c, b, Red);
        }
        triangles.push(t)
    }
    return iterate(deflateMany, triangles, iterations);
}

function drawP2(context: CanvasRenderingContext2D, triangles: Triangle[]): void {
    // fill canvas with "red" to cut out half the .fill calls later
    context.fillStyle = Red;
    context.fillRect(0, 0, context.canvas.width, context.canvas.height);
    context.strokeStyle = "#333333"; // outline colour
    for (let t of triangles) {
        drawP2Triangle(context, t);
    }
}

function drawP2Pixi(g: Graphics, canvasW: number, canvasH: number, triangles: Triangle[]): void {
    g.lineStyle(1, 0x333333, 1);
    g.beginFill(RedHex, 1); // This way we don't need to fill half the triangles
    g.drawRect(0, 0, canvasW, canvasH);
    g.endFill();
    for (let t of triangles) {
        drawP2TrianglePixi(g, t);
    }
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

/** Run the app using HTML5 canvas directly. */
function mainCanvas(): void {
    const start = Date.now();
    const margin = {top: 50, right: 50, bottom: 50, left: 50};
    const borderThickness = 1;
    const [canvasW, canvasH] = calcCanvasDims(margin, borderThickness);
    const container = getCanvasContainer(margin, `${borderThickness}px solid #333`);

    const canvas = createCanvas(canvasW, canvasH);
    container.appendChild(canvas);

    const context = canvas.getContext("2d");
    if (!context) {
        throw new Error("could not get 2d context");
    }

    const triangles = generateP2Tiling(canvasW, canvasH, 7);

    const centre = new Vec2(canvasW / 2, canvasH / 2);

    const draw = () => {
        //const start = Date.now();
        drawP2(context, triangles);
        triangles.forEach(t => t.rotate(0.01, centre));
        // console.log(Date.now(), "done animation frame", Date.now() - start);
        requestAnimationFrame(draw);
    };
    requestAnimationFrame(draw);

    console.log(`mainCanvas() ran in ${Date.now() - start} ms - ${triangles.length} triangles`);
}

/** Run the app using Pixi's renderer instead of direct canvas. */
function mainPixi(): void {
    const start = Date.now();
    const margin = {top: 50, right: 50, bottom: 50, left: 50};
    const borderThickness = 1;
    const [canvasW, canvasH] = calcCanvasDims(margin, borderThickness);
    const renderer = PIXI.autoDetectRenderer(canvasW, canvasH, {antialias: true});
    // const renderer = new WebGLRenderer(canvasW, canvasH, {antialias: true});
    console.log("renderer", renderer);
    const containerElement = getCanvasContainer(margin, `${borderThickness}px solid #333`);
    disableScrollbars(renderer.view);
    containerElement.appendChild(renderer.view);

    const g = new Graphics();
    const stage = new PIXI.Container();
    stage.addChild(g);

    const triangles = generateP2Tiling(canvasW, canvasH, 7);
    const centre = new Vec2(canvasW / 2, canvasH / 2);
    const draw = () => {
        g.clear();
        drawP2Pixi(g, canvasW, canvasH, triangles);
        renderer.render(stage);
        // stage.rotation += 0.01;
        triangles.forEach(t => t.rotate(0.01, centre));
        requestAnimationFrame(draw);
    };
    requestAnimationFrame(draw);

    console.log(`mainPixi() ran in ${Date.now() - start} ms - ${triangles.length} triangles`);
}

mainPixi();
// mainCanvas();
