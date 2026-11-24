import { Color, Geometry, Mesh, Shader, UniformGroup } from 'pixi.js';
import type { GpuNode } from './gpu-renderer';

/** One quad per ring. Zoom changes a uniform instead of tessellating every dash. */
export class GpuRings {
    private uniforms = new UniformGroup({uZoom: {value: 1, type: 'f32'}});
    private geometry = new Geometry({attributes: {
        aPosition: {buffer: new Float32Array(8), format: 'float32x2'},
        aCenter: {buffer: new Float32Array(8), format: 'float32x2'},
        aParameters: {buffer: new Float32Array(12), format: 'float32x3'},
        aColor: {buffer: new Float32Array(16), format: 'float32x4'},
    }, indexBuffer: new Uint32Array(6)});
    private shader = Shader.from({gl: {vertex: `#version 300 es
        in vec2 aPosition;
        in vec2 aCenter;
        in vec3 aParameters;
        in vec4 aColor;
        uniform mat3 uProjectionMatrix;
        uniform mat3 uWorldTransformMatrix;
        uniform mat3 uTransformMatrix;
        uniform float uZoom;
        out vec2 vLocal;
        out vec3 vParameters;
        out vec4 vColor;
        void main() {
            float extent = aParameters.x + (aParameters.y * .5 + 1.5) / uZoom;
            vLocal = aPosition * extent;
            vParameters = vec3(aParameters.x, aParameters.y * .5 / uZoom, aParameters.z);
            vColor = aColor;
            gl_Position = vec4((uProjectionMatrix * uWorldTransformMatrix * uTransformMatrix * vec3(aCenter + vLocal, 1.)).xy, 0., 1.);
        }`, fragment: `#version 300 es
        in vec2 vLocal;
        in vec3 vParameters;
        in vec4 vColor;
        out vec4 finalColor;
        void main() {
            float d = abs(length(vLocal) - vParameters.x);
            float aa = max(fwidth(d), .0001);
            float coverage = 1. - smoothstep(vParameters.y - aa, vParameters.y + aa, d);
            if (vParameters.z > .5) {
                float angle = atan(vLocal.y, vLocal.x);
                float arc = (angle < 0. ? angle + 6.28318530718 : angle) * vParameters.x;
                // Same four-unit dash and nine-unit period as the canvas renderer.
                float phase = mod(arc, 9.);
                float edge = aa;
                coverage *= smoothstep(0., edge, phase) * (1. - smoothstep(4. - edge, 4., phase));
            }
            float alpha = vColor.a * coverage;
            if (alpha < .001) discard;
            finalColor = vec4(vColor.rgb * alpha, alpha);
        }`}, resources: {ringUniforms: this.uniforms}});
    readonly mesh = new Mesh({geometry: this.geometry, shader: this.shader});
    private previous: number[] = [];
    constructor() { this.mesh.visible = false; }
    private color = new Color();
    setZoom(zoom: number) { this.uniforms.uniforms.uZoom = zoom; }
    paint(nodes: GpuNode[], zoom: number) {
        const zoomChanged = this.uniforms.uniforms.uZoom !== zoom;
        this.uniforms.uniforms.uZoom = zoom;
        const values: number[] = [];
        for (const n of nodes) for (const r of n.rings) {
            this.color.setValue(r.color);
            const [red, green, blue] = this.color.toArray();
            values.push(n.x, n.y, r.radius, Math.round(r.width * zoom * 1000) / 1000, r.dashed ? 1 : 0, red, green, blue, r.alpha * n.alpha);
        }
        if (values.length === this.previous.length && values.every((value, i) => value === this.previous[i])) return zoomChanged;
        this.previous = values;
        const count = values.length / 9;
        this.mesh.visible = count > 0;
        if (!count) return true;
        const positions = new Float32Array(count * 8), centers = new Float32Array(count * 8);
        const parameters = new Float32Array(count * 12), colors = new Float32Array(count * 16), indices = new Uint32Array(count * 6);
        for (let i = 0; i < count; i++) {
            const v = i * 9;
            positions.set([-1,-1,1,-1,1,1,-1,1], i * 8);
            for (let j = 0; j < 4; j++) {
                centers.set(values.slice(v, v + 2), i * 8 + j * 2);
                parameters.set(values.slice(v + 2, v + 5), i * 12 + j * 3);
                colors.set(values.slice(v + 5, v + 9), i * 16 + j * 4);
            }
            const base = i * 4;
            indices.set([base,base+1,base+2,base,base+2,base+3], i * 6);
        }
        this.geometry.getBuffer('aPosition').data = positions;
        this.geometry.getBuffer('aCenter').data = centers;
        this.geometry.getBuffer('aParameters').data = parameters;
        this.geometry.getBuffer('aColor').data = colors;
        this.geometry.indexBuffer!.data = indices;
        return true;
    }
    destroy() { this.mesh.destroy(); this.geometry.destroy(true); this.shader.destroy(); }
}
