import {CurveStrip} from './curve-strip';
import { Container, Graphics, GraphicsContext, FillGradient, Sprite, Texture, MeshSimple, WebGLRenderer } from 'pixi.js';
import { measureText } from './footprint';
import { iconSprite } from './sprites';
import type { Camera } from './model';
export interface GpuEdge {
    id: string;
    ax: number;
    ay: number;
    cx: number;
    cy: number;
    bx: number;
    by: number;
    width: number;
    color: string;
    alpha: number;
}
export interface GpuLabel {
    text: string;
    x: number;
    y: number;
    size: number;
    color: string;
    background?: string;
    alpha: number;
}
export interface GpuRing {
    radius: number;
    color: string;
    width: number;
    alpha: number;
    dashed: boolean;
}
export interface GpuDot {
    id: string;
    x: number;
    y: number;
    radius: number;
    color: string;
    alpha: number;
}
export interface GpuEdgeLabel extends GpuLabel {
    id: string;
}
export interface GpuNode {
    id: string;
    x: number;
    y: number;
    radius: number;
    shape: string;
    style: string;
    color: string;
    ink: string;
    strokeWidth: number;
    soft: boolean;
    icon: string;
    iconSize: number;
    iconVisible: boolean;
    pinned: boolean;
    pinVisible: boolean;
    pinColor: string;
    pinFill: string;
    bodyAlpha: number;
    alpha: number;
    labels: GpuLabel[];
    rings: GpuRing[];
}
interface LabelEntry {
    sprite: Sprite;
    texture: Texture;
    signature: string;
    bytes: number;
}
interface NodeEntry {
    root: Container;
    body: Graphics;
    flat: GraphicsContext;
    soft: GraphicsContext;
    pin: Graphics;
    icon: Sprite;
    gradientKey: string;
    iconKey: string;
    signature: string;
    labels: LabelEntry[];
    labelLayer: Container;
    rings: Graphics;
    ringSignature: string;
    usedAt: number;
}
interface GradientEntry {
    fill: FillGradient;
    refs: number;
}
interface IconEntry {
    texture: Texture;
    refs: number;
    bytes: number;
}
const RASTER_SCALE = 4, BASE_FONT = 13;
/** Camera changes transform retained parts; text rasterization and body geometry never depend on zoom. */
export class GpuMapRenderer {
    constructor(private onchange: () => void = () => { }) { }
    private renderer = new WebGLRenderer();
    private stage = new Container();
    private world = new Container();
    private lines = new Container();
    private edgeCache = new Map<string,{mesh:MeshSimple;strip:CurveStrip;usedAt:number;order:number;color:string}>();
    private curveBuilds=0;
    private field = new Container();
    private dotLayer = new Container();
    private edgeLabelLayer = new Container();
    private dotTexture?: Texture;
    private dotsCache = new Map<string, {
        sprite: Sprite;
        usedAt: number;
        color: string;
    }>();
    private edgeLabelCache = new Map<string, {
        labels: LabelEntry[];
        labelLayer: Container;
        usedAt: number;
    }>();
    private gradients = new Map<string, GradientEntry>();
    private icons = new Map<string, IconEntry>();
    private nodes = new Map<string, NodeEntry>();
    private width = 0;
    private height = 0;
    private resolution = 0;
    private textureBytes = 0;
    private frame = 0;
    private textureBuilds = 0;
    private readonly cacheBytes = 64 * 1024 * 1024;
    private readonly cacheNodes = 2048;
    private lost = false;
    private onlost = (event: Event) => { event.preventDefault(); this.lost = true; this.onchange(); };
    private onrestored = () => { this.lost = false; this.invalidate(); this.onchange(); };
    static async create(onchange: () => void = () => { }) {
        const value = new GpuMapRenderer(onchange);
        try {
            await value.renderer.init({ width: 1, height: 1, antialias: true, backgroundAlpha: 0, clearBeforeRender: true, autoDensity: false, failIfMajorPerformanceCaveat: false });
            const gl = value.renderer.gl, info = gl.getExtension('WEBGL_debug_renderer_info');
            const device = info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : '';
            if (/swiftshader|llvmpipe|softpipe|software|microsoft basic render/i.test(device))
                throw Error('Hardware WebGL unavailable');
            value.stage.eventMode = 'none';
            value.field.sortableChildren = true;
            value.stage.addChild(value.world);
            value.world.addChild(value.dotLayer, value.lines, value.field, value.edgeLabelLayer);
            value.prepareDot();
            value.canvas.addEventListener('webglcontextlost', value.onlost);
            value.canvas.addEventListener('webglcontextrestored', value.onrestored);
            return value;
        }
        catch (error) {
            try {
                value.renderer.destroy();
            }
            catch { }
            throw error;
        }
    }
    get canvas() { return this.renderer.canvas as HTMLCanvasElement; }
    get available() { return !this.lost; }
    invalidate() {
        for (const entry of this.edgeLabelCache.values())
            for (const label of entry.labels)
                label.signature = '';
        for (const n of this.nodes.values()) {
            n.signature = '';
            n.ringSignature = '\0';
            for (const label of n.labels)
                label.signature = '';
        }
    }
    private built() { this.textureBuilds++; this.canvas.dataset.textureBuilds = String(this.textureBuilds); }
    private entry() { const root = new Container(), flat = new GraphicsContext(), soft = new GraphicsContext(), body = new Graphics({ context: flat }), rings = new Graphics(), pin = new Graphics(), icon = new Sprite(), labelLayer = new Container(); icon.anchor.set(.5); root.addChild(rings, body, icon, pin, labelLayer); this.field.addChild(root); return { root, body, flat, soft, rings, pin, icon, labelLayer, gradientKey: '', iconKey: '', signature: '', labels: [], ringSignature: '\0', usedAt: 0 } as NodeEntry; }
    private releaseGradient(key: string) {
        const known = this.gradients.get(key);
        if (known && !--known.refs) {
            known.fill.destroy();
            this.gradients.delete(key);
            this.textureBytes -= 128 * 128 * 4;
        }
    }
    private releaseIcon(key: string) {
        const known = this.icons.get(key);
        if (known && !--known.refs) {
            known.texture.destroy(true);
            this.icons.delete(key);
            this.textureBytes -= known.bytes;
        }
    }
    private gradient(color: string, radius: number) {
        const key = color + '|' + radius;
        let known = this.gradients.get(key);
        if (!known) {
            const fill = new FillGradient({ type: 'radial', textureSpace: 'global', textureSize: 128, center: { x: -radius * .3, y: -radius * .4 }, outerCenter: { x: 0, y: 0 }, innerRadius: 0, outerRadius: radius * 1.5, colorStops: [{ offset: 0, color: color + '30' }, { offset: 1, color: color + '08' }] });
            fill.buildGradient();
            known = { fill, refs: 0 };
            this.gradients.set(key, known);
            this.textureBytes += 128 * 128 * 4;
            this.built();
        }
        known.refs++;
        return { key, fill: known.fill };
    }
    private icon(n: GpuNode) {
        const key = [n.icon, n.ink, n.iconSize].join('|');
        let known = this.icons.get(key);
        if (!known) {
            const source = iconSprite(n.icon, n.ink, n.iconSize), texture = Texture.from(source);
            known = { texture, refs: 0, bytes: source.width * source.height * 4 };
            this.icons.set(key, known);
            this.textureBytes += known.bytes;
            this.built();
        }
        known.refs++;
        return { key, texture: known.texture };
    }
    private remove(node: NodeEntry) {
        this.textureBytes -= node.labels.reduce((sum, l) => sum + l.bytes, 0);
        node.body.destroy();
        node.pin.destroy();
        node.rings.destroy();
        node.root.destroy({ children: true });
        node.flat.destroy();
        node.soft.destroy();
        this.releaseGradient(node.gradientKey);
        this.releaseIcon(node.iconKey);
        for (const label of node.labels)
            label.texture.destroy(true);
    }
    private shape(context: GraphicsContext, n: GpuNode) {
        if (n.shape === 'square')
            context.roundRect(-n.radius, -n.radius, n.radius * 2, n.radius * 2, 10);
        else if (n.shape === 'diamond')
            context.poly([0, -n.radius * 1.2, n.radius * 1.2, 0, 0, n.radius * 1.2, -n.radius * 1.2, 0]);
        else
            context.circle(0, 0, n.radius);
        return context;
    }
    private outline(context: GraphicsContext, n: GpuNode) {
        if (n.style !== 'dashed') {
            context.stroke({ color: n.ink, width: n.strokeWidth });
            return;
        }
        const points: {
            x: number;
            y: number;
        }[] = [];
        if (n.shape === 'diamond') {
            const r = n.radius * 1.2;
            points.push({ x: 0, y: -r }, { x: r, y: 0 }, { x: 0, y: r }, { x: -r, y: 0 });
        }
        else if (n.shape === 'square') {
            const r = n.radius, c = Math.min(10, r);
            for (const [x, y, start] of [[r - c, -r + c, -Math.PI / 2], [r - c, r - c, 0], [-r + c, r - c, Math.PI / 2], [-r + c, -r + c, Math.PI]])
                for (let i = 0; i <= 12; i++) {
                    const angle = start + i * Math.PI / 24;
                    points.push({ x: x + Math.cos(angle) * c, y: y + Math.sin(angle) * c });
                }
        }
        else
            for (let i = 0; i < 128; i++) {
                const angle = i * Math.PI / 64;
                points.push({ x: Math.cos(angle) * n.radius, y: Math.sin(angle) * n.radius });
            }
        context.beginPath();
        let phase = 0;
        for (let i = 0; i < points.length; i++) {
            const a = points[i], b = points[(i + 1) % points.length], length = Math.hypot(b.x - a.x, b.y - a.y);
            let distance = 0;
            while (distance < length) {
                const drawing = phase < 5, step = Math.min(length - distance, (drawing ? 5 : 9) - phase), start = distance / length, end = (distance + step) / length;
                if (drawing) {
                    context.moveTo(a.x + (b.x - a.x) * start, a.y + (b.y - a.y) * start);
                    context.lineTo(a.x + (b.x - a.x) * end, a.y + (b.y - a.y) * end);
                }
                distance += step;
                phase = (phase + step) % 9;
            }
        }
        context.stroke({ color: n.ink, width: n.strokeWidth });
    }
    private body(entry: NodeEntry, n: GpuNode) {
        const signature = [n.radius, n.shape, n.style, n.color, n.ink, n.strokeWidth, n.pinned, n.pinColor, n.pinFill].join('|');
        let changed = false;
        if (entry.signature !== signature) {
            const gradient = this.gradient(n.color, n.radius), flat = new GraphicsContext(), soft = new GraphicsContext();
            this.shape(flat, n).fill({ color: n.color, alpha: 24 / 255 });
            this.outline(flat, n);
            this.shape(soft, n).fill(gradient.fill);
            this.outline(soft, n);
            const oldFlat = entry.flat, oldSoft = entry.soft, oldGradient = entry.gradientKey;
            entry.flat = flat;
            entry.soft = soft;
            entry.body.context = n.soft ? soft : flat;
            entry.gradientKey = gradient.key;
            oldFlat.destroy();
            oldSoft.destroy();
            this.releaseGradient(oldGradient);
            entry.signature = signature;
            entry.pin.clear();
            if (n.pinned) {
                entry.pin.moveTo(-5, -8).lineTo(5, -8).lineTo(3, -1).quadraticCurveTo(7, 1, 7, 4).lineTo(-7, 4).quadraticCurveTo(-7, 1, -3, -1).closePath().fill({ color: n.pinFill }).stroke({ color: n.pinColor, width: 1.8, join: 'round', cap: 'round' });
                entry.pin.moveTo(0, 4).lineTo(0, 12).stroke({ color: n.pinColor, width: 1.8, cap: 'round' });
            }
            entry.pin.position.set(n.radius - 2, -n.radius - 3);
            entry.pin.scale.set(.85);
            entry.pin.rotation = .55;
            changed = true;
        }
        const context = n.soft ? entry.soft : entry.flat;
        if (entry.body.context !== context) {
            entry.body.context = context;
            changed = true;
        }
        const iconKey = [n.icon, n.ink, n.iconSize].join('|');
        if (entry.iconKey !== iconKey) {
            const icon = this.icon(n), old = entry.iconKey;
            entry.icon.texture = icon.texture;
            entry.iconKey = icon.key;
            this.releaseIcon(old);
            entry.icon.scale.set(n.iconSize * 2 / icon.texture.width);
            changed = true;
        }
        if (entry.icon.visible !== n.iconVisible || entry.pin.visible !== n.pinVisible || entry.body.alpha !== n.bodyAlpha)
            changed = true;
        entry.icon.visible = n.iconVisible;
        entry.pin.visible = n.pinVisible;
        entry.body.alpha = entry.icon.alpha = entry.pin.alpha = n.bodyAlpha;
        return changed;
    }
    private labels(entry: Pick<NodeEntry, 'labels' | 'labelLayer'>, labels: GpuLabel[]) {
        let changed = false;
        for (let i = 0; i < labels.length; i++) {
            const label = labels[i], signature = [label.text, label.color, label.background || ''].join('\0');
            let cached = entry.labels[i];
            if (!cached || cached.signature !== signature) {
                const padding = label.background ? 3 : 0, width = measureText(label.text, BASE_FONT) + padding * 2, height = BASE_FONT + 3, canvas = document.createElement('canvas');
                canvas.width = Math.max(1, Math.ceil(width * RASTER_SCALE));
                canvas.height = Math.ceil(height * RASTER_SCALE);
                const ctx = canvas.getContext('2d')!;
                ctx.scale(RASTER_SCALE, RASTER_SCALE);
                if (label.background) {
                    ctx.fillStyle = label.background;
                    ctx.fillRect(0, 0, width, height);
                }
                ctx.font = BASE_FONT + 'px system-ui';
                ctx.textBaseline = 'top';
                ctx.textAlign = 'center';
                ctx.fillStyle = label.color;
                ctx.fillText(label.text, width / 2, 0);
                const texture = Texture.from(canvas), bytes = canvas.width * canvas.height * 4;
                if (cached) {
                    this.textureBytes -= cached.bytes;
                    const old = cached.texture;
                    cached.sprite.texture = texture;
                    cached.texture = texture;
                    old.destroy(true);
                    cached.bytes = bytes;
                    cached.signature = signature;
                }
                else {
                    const sprite = new Sprite(texture);
                    sprite.anchor.set(.5, 0);
                    entry.labelLayer.addChild(sprite);
                    cached = { sprite, texture, signature, bytes };
                    entry.labels.push(cached);
                }
                this.textureBytes += bytes;
                this.built();
                changed = true;
            }
            const scale = label.size / BASE_FONT / RASTER_SCALE;
            if (!cached.sprite.visible) {
                cached.sprite.visible = true;
                changed = true;
            }
            if (cached.sprite.x !== label.x || cached.sprite.y !== label.y || cached.sprite.scale.x !== scale || cached.sprite.alpha !== label.alpha)
                changed = true;
            cached.sprite.position.set(label.x, label.y);
            cached.sprite.scale.set(scale);
            cached.sprite.alpha = label.alpha;
        }
        for (let i = labels.length; i < entry.labels.length; i++)
            if (entry.labels[i].sprite.visible) {
                entry.labels[i].sprite.visible = false;
                changed = true;
            }
        return changed;
    }
    private prepareDot() { const canvas = document.createElement('canvas'); canvas.width = canvas.height = 64; const ctx = canvas.getContext('2d')!; ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(32, 32, 32, 0, Math.PI * 2); ctx.fill(); this.dotTexture = Texture.from(canvas); this.textureBytes += 64 * 64 * 4; this.built(); }
    private drawDots(dots: GpuDot[], frame: number) {
        let changed = false;
        const seen = new Set<string>();
        for (const dot of dots) {
            seen.add(dot.id);
            let entry = this.dotsCache.get(dot.id);
            if (!entry) {
                const sprite = new Sprite(this.dotTexture!);
                sprite.anchor.set(.5);
                this.dotLayer.addChild(sprite);
                entry = { sprite, usedAt: frame, color: '' };
                this.dotsCache.set(dot.id, entry);
                changed = true;
            }
            const scale = dot.radius / 32, s = entry.sprite;
            if (!s.visible || s.x !== dot.x || s.y !== dot.y || s.scale.x !== scale || s.alpha !== dot.alpha || entry.color !== dot.color)
                changed = true;
            s.visible = true;
            s.position.set(dot.x, dot.y);
            s.scale.set(scale);
            s.alpha = dot.alpha;
            if (entry.color !== dot.color) {
                s.tint = dot.color;
                entry.color = dot.color;
            }
            entry.usedAt = frame;
        }
        for (const [id, entry] of this.dotsCache)
            if (!seen.has(id) && entry.sprite.visible) {
                entry.sprite.visible = false;
                changed = true;
            }
        if (this.dotsCache.size > 4096)
            for (const [id, entry] of [...this.dotsCache].filter(([id]) => !seen.has(id)).sort((a, b) => a[1].usedAt - b[1].usedAt)) {
                if (this.dotsCache.size <= 4096)
                    break;
                entry.sprite.destroy();
                this.dotsCache.delete(id);
            }
        return changed;
    }
    private drawEdgeLabels(labels: GpuEdgeLabel[], frame: number) {
        let changed = false;
        const seen = new Set<string>();
        for (const label of labels) {
            seen.add(label.id);
            let entry = this.edgeLabelCache.get(label.id);
            if (!entry) {
                const labelLayer = new Container();
                this.edgeLabelLayer.addChild(labelLayer);
                entry = { labels: [], labelLayer, usedAt: frame };
                this.edgeLabelCache.set(label.id, entry);
                changed = true;
            }
            if (!entry.labelLayer.visible) {
                entry.labelLayer.visible = true;
                changed = true;
            }
            if (this.labels(entry, [label]))
                changed = true;
            entry.usedAt = frame;
        }
        for (const [id, entry] of this.edgeLabelCache)
            if (!seen.has(id) && entry.labelLayer.visible) {
                entry.labelLayer.visible = false;
                changed = true;
            }
        if (this.textureBytes > this.cacheBytes || this.edgeLabelCache.size > 4096)
            for (const [id, entry] of [...this.edgeLabelCache].filter(([id]) => !seen.has(id)).sort((a, b) => a[1].usedAt - b[1].usedAt)) {
                if (this.textureBytes <= this.cacheBytes && this.edgeLabelCache.size <= 4096)
                    break;
                this.textureBytes -= entry.labels.reduce((sum, label) => sum + label.bytes, 0);
                entry.labelLayer.destroy({ children: true });
                for (const label of entry.labels)
                    label.texture.destroy(true);
                this.edgeLabelCache.delete(id);
            }
        return changed;
    }
    private rings(entry: NodeEntry, rings: GpuRing[]) {
        const signature = rings.map(r => [r.radius, r.color, r.width, r.alpha, r.dashed].join(',')).join('|');
        if (signature === entry.ringSignature)
            return false;
        entry.ringSignature = signature;
        entry.rings.clear();
        for (const ring of rings) {
            if (ring.dashed) {
                const gap = 9 / ring.radius, dash = 4 / ring.radius;
                for (let angle = 0; angle < Math.PI * 2; angle += gap) {
                    entry.rings.moveTo(Math.cos(angle) * ring.radius, Math.sin(angle) * ring.radius);
                    entry.rings.arc(0, 0, ring.radius, angle, Math.min(angle + dash, Math.PI * 2));
                }
            }
            else
                entry.rings.circle(0, 0, ring.radius);
            entry.rings.stroke({ color: ring.color, width: ring.width, alpha: ring.alpha });
        }
        return true;
    }
    paint(width: number, height: number, resolution: number, camera: Camera, edges: GpuEdge[], nodes: GpuNode[], dots: GpuDot[] = [], edgeLabels: GpuEdgeLabel[] = []) {
        if (this.lost)
            return false;
        let changed = width !== this.width || height !== this.height || resolution !== this.resolution || this.world.x !== width / 2 + camera.x || this.world.y !== height / 2 + camera.y || this.world.scale.x !== camera.zoom;
        if (width !== this.width || height !== this.height || resolution !== this.resolution) {
            this.renderer.resize(width, height, resolution);
            this.width = width;
            this.height = height;
            this.resolution = resolution;
        }
        this.world.position.set(width / 2 + camera.x, height / 2 + camera.y);
        this.world.scale.set(camera.zoom);
        const edgeFrame=this.frame+1;
        let edgeOrder=0;
        for(const edge of edges){
            let entry=this.edgeCache.get(edge.id);
            if(!entry){const strip=new CurveStrip(),mesh=new MeshSimple({texture:Texture.WHITE,vertices:strip.vertices,uvs:strip.uvs,indices:strip.indices});mesh.autoUpdate=false;this.lines.addChild(mesh);entry={mesh,strip,usedAt:edgeFrame,order:edgeOrder,color:edge.color};this.edgeCache.set(edge.id,entry);changed=true;}
            const update=entry.strip.update(edge,edge.width);
            if(update.updated){entry.mesh.geometry.getBuffer('aPosition').update();changed=true;}
            if(update.rebuilt){this.curveBuilds++;this.canvas.dataset.curveBuilds=String(this.curveBuilds);}
            if(!entry.mesh.visible||entry.mesh.alpha!==edge.alpha||entry.color!==edge.color||entry.order!==edgeOrder)changed=true;
            entry.mesh.visible=true;entry.mesh.alpha=edge.alpha;entry.mesh.tint=edge.color;entry.color=edge.color;
            if(entry.order!==edgeOrder)this.lines.setChildIndex(entry.mesh,Math.min(edgeOrder,this.lines.children.length-1));
            entry.order=edgeOrder++;entry.usedAt=edgeFrame;
        }
        for(const [id,entry] of this.edgeCache)if(entry.usedAt!==edgeFrame){
            if(entry.mesh.visible){entry.mesh.visible=false;changed=true;}
            if(this.edgeCache.size>4096||edgeFrame-entry.usedAt>180){entry.mesh.geometry.destroy();entry.mesh.destroy();this.edgeCache.delete(id);}
        }
        const used = new Set<string>(), frame = ++this.frame;
        let order = 0;
        for (const n of nodes) {
            used.add(n.id);
            let cached = this.nodes.get(n.id);
            if (!cached) {
                cached = this.entry();
                this.nodes.set(n.id, cached);
                changed = true;
            }
            if (this.body(cached, n))
                changed = true;
            if (this.labels(cached, n.labels))
                changed = true;
            if (this.rings(cached, n.rings))
                changed = true;
            if (!cached.root.visible || cached.root.x !== n.x || cached.root.y !== n.y || cached.root.alpha !== n.alpha || cached.root.zIndex !== order)
                changed = true;
            cached.usedAt = frame;
            cached.root.visible = true;
            cached.root.position.set(n.x, n.y);
            cached.root.alpha = n.alpha;
            cached.root.zIndex = order++;
        }
        for (const [id, n] of this.nodes)
            if (!used.has(id) && n.root.visible) {
                n.root.visible = false;
                changed = true;
            }
        if (this.textureBytes > this.cacheBytes || this.nodes.size > this.cacheNodes) {
            const stale = [...this.nodes].filter(([id]) => !used.has(id)).sort((a, b) => a[1].usedAt - b[1].usedAt);
            for (const [id, n] of stale) {
                if (this.textureBytes <= this.cacheBytes && this.nodes.size <= this.cacheNodes)
                    break;
                this.remove(n);
                this.nodes.delete(id);
            }
        }
        if (this.drawDots(dots, frame))
            changed = true;
        if (this.drawEdgeLabels(edgeLabels, frame))
            changed = true;
        if (changed)
            this.renderer.render(this.stage);
        return true;
    }
    destroy() {
        this.canvas.removeEventListener('webglcontextlost', this.onlost);
        this.canvas.removeEventListener('webglcontextrestored', this.onrestored);
        for (const node of this.nodes.values())
            this.remove(node);
        this.nodes.clear();
        for(const entry of this.edgeCache.values()){entry.mesh.geometry.destroy();entry.mesh.destroy();}
        this.edgeCache.clear();
        this.lines.destroy();
        for (const entry of this.edgeLabelCache.values()) {
            entry.labelLayer.destroy({ children: true });
            for (const label of entry.labels)
                label.texture.destroy(true);
        }
        this.edgeLabelCache.clear();
        this.dotsCache.clear();
        this.stage.destroy({ children: true });
        this.dotTexture?.destroy(true);
        this.renderer.destroy();
    }
}
