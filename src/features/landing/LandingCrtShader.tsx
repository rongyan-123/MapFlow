import { useEffect, useRef } from 'react';

const CRT_VERTEX_SHADER = `
  attribute vec2 aPosition;
  varying vec2 vUv;

  void main() {
    vUv = aPosition * 0.5 + 0.5;
    gl_Position = vec4(aPosition, 0.0, 1.0);
  }
`;

const CRT_FRAGMENT_SHADER = `
  precision highp float;
  uniform sampler2D uSource;
  uniform vec2 uResolution;
  uniform float uBarrel;
  uniform float uChannelOffset;
  uniform float uIntensity;
  varying vec2 vUv;

  float hash(vec2 seed) {
    return fract(sin(dot(seed, vec2(17.13, 91.71))) * 43758.5453);
  }

  void main() {
    vec2 centered = vUv - 0.5;
    vec2 aspectCentered = centered;
    aspectCentered.x *= uResolution.x / max(uResolution.y, 1.0);
    float radius = length(aspectCentered);
    vec2 warped = 0.5 + centered * (1.0 + uBarrel * radius * radius);

    vec4 red = texture2D(uSource, warped + vec2(uChannelOffset, 0.0));
    vec4 green = texture2D(uSource, warped);
    vec4 blue = texture2D(uSource, warped - vec2(uChannelOffset, 0.0));
    float scanline = 1.0 - uIntensity * 0.08 * (0.5 + 0.5 * sin(warped.y * uResolution.y * 1.25));
    float grain = (hash(gl_FragCoord.xy) - 0.5) * uIntensity * 0.08;
    float vignette = 1.0 - uIntensity * smoothstep(0.28, 0.9, radius);
    float alpha = (red.a + green.a + blue.a) / 3.0 * uIntensity * vignette;
    vec3 color = vec3(red.r, green.g, blue.b) * scanline + grain;

    gl_FragColor = vec4(color, alpha);
  }
`;

interface CrtEffectParameters {
  barrel: number;
  channelOffset: number;
  intensity: number;
}

function clampUnit(value: number) {
  return Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
}

function getCrtEffectParameters(progress: number): CrtEffectParameters {
  const residual = 1 - clampUnit(progress);
  return {
    barrel: Number((0.12 * residual).toFixed(4)),
    channelOffset: Number((0.0028 * residual).toFixed(4)),
    intensity: Number((0.24 * residual).toFixed(4)),
  };
}

function setRendererState(canvas: HTMLCanvasElement, state: 'fallback' | 'webgl') {
  canvas.dataset.crtRenderer = state;
}

function wrapText(
  text: string,
  context: CanvasRenderingContext2D,
  maxWidth: number,
): string[] {
  const lines: string[] = [];
  let line = '';
  for (const character of Array.from(text)) {
    const nextLine = line + character;
    if (line && context.measureText(nextLine).width > maxWidth) {
      lines.push(line);
      line = character;
    } else {
      line = nextLine;
    }
  }
  if (line) lines.push(line);
  return lines;
}

interface LandingCrtShaderProps {
  text: string;
  progress?: number;
}

export default function LandingCrtShader({ text, progress = 0 }: LandingCrtShaderProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const progressRef = useRef(progress);
  const renderRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    progressRef.current = clampUnit(progress);
    if (canvasRef.current) {
      canvasRef.current.dataset.crtProgress = String(progressRef.current);
    }
    renderRef.current?.();
  }, [progress]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const host = canvas?.parentElement;
    if (!canvas || !host || typeof window === 'undefined') return undefined;

    if (typeof window.WebGLRenderingContext === 'undefined') {
      setRendererState(canvas, 'fallback');
      return undefined;
    }

    let gl: WebGLRenderingContext | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let disposed = false;

    try {
      gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: false });
      if (!gl) throw new Error('CRT WebGL context is unavailable');

      const compileShader = (type: number, source: string) => {
        const shader = gl!.createShader(type);
        if (!shader) throw new Error('CRT shader allocation failed');
        gl!.shaderSource(shader, source);
        gl!.compileShader(shader);
        if (!gl!.getShaderParameter(shader, gl!.COMPILE_STATUS)) {
          const message = gl!.getShaderInfoLog(shader) ?? 'CRT shader compilation failed';
          gl!.deleteShader(shader);
          throw new Error(message);
        }
        return shader;
      };

      const vertexShader = compileShader(gl.VERTEX_SHADER, CRT_VERTEX_SHADER);
      const fragmentShader = compileShader(gl.FRAGMENT_SHADER, CRT_FRAGMENT_SHADER);
      const program = gl.createProgram();
      if (!program) throw new Error('CRT shader program allocation failed');
      gl.attachShader(program, vertexShader);
      gl.attachShader(program, fragmentShader);
      gl.linkProgram(program);
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        throw new Error(gl.getProgramInfoLog(program) ?? 'CRT shader linking failed');
      }

      const positionBuffer = gl.createBuffer();
      const texture = gl.createTexture();
      if (!positionBuffer || !texture) throw new Error('CRT buffer allocation failed');

      const positionLocation = gl.getAttribLocation(program, 'aPosition');
      const sourceLocation = gl.getUniformLocation(program, 'uSource');
      const resolutionLocation = gl.getUniformLocation(program, 'uResolution');
      const barrelLocation = gl.getUniformLocation(program, 'uBarrel');
      const channelOffsetLocation = gl.getUniformLocation(program, 'uChannelOffset');
      const intensityLocation = gl.getUniformLocation(program, 'uIntensity');
      const sourceCanvas = document.createElement('canvas');
      const sourceContext = sourceCanvas.getContext('2d');
      if (!sourceContext) throw new Error('CRT source canvas is unavailable');

      const resizeAndPaint = () => {
        const rect = host.getBoundingClientRect();
        const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
        const cssWidth = Math.max(1, rect.width);
        const cssHeight = Math.max(1, rect.height);
        const width = Math.max(1, Math.round(cssWidth * pixelRatio));
        const height = Math.max(1, Math.round(cssHeight * pixelRatio));
        canvas.width = width;
        canvas.height = height;
        sourceCanvas.width = width;
        sourceCanvas.height = height;
        sourceContext.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
        sourceContext.clearRect(0, 0, cssWidth, cssHeight);

        const title = host.querySelector('h2');
        const style = title ? window.getComputedStyle(title) : null;
        sourceContext.font = style
          ? `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`
          : '900 48px sans-serif';
        sourceContext.fillStyle = '#ffffff';
        sourceContext.textBaseline = 'top';
        const fontSize = Number.parseFloat(style?.fontSize ?? '') || 48;
        const lineHeight = Number.parseFloat(style?.lineHeight ?? '') || fontSize * 1.1;
        wrapText(text, sourceContext, cssWidth).forEach((line, index) => {
          sourceContext.fillText(line, 0, index * lineHeight);
        });

        gl!.bindTexture(gl!.TEXTURE_2D, texture);
        gl!.pixelStorei(gl!.UNPACK_FLIP_Y_WEBGL, 1);
        gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_WRAP_S, gl!.CLAMP_TO_EDGE);
        gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_WRAP_T, gl!.CLAMP_TO_EDGE);
        gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_MIN_FILTER, gl!.LINEAR);
        gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_MAG_FILTER, gl!.LINEAR);
        gl!.texImage2D(
          gl!.TEXTURE_2D,
          0,
          gl!.RGBA,
          gl!.RGBA,
          gl!.UNSIGNED_BYTE,
          sourceCanvas,
        );
      };

      const render = () => {
        if (disposed) return;
        const parameters = getCrtEffectParameters(progressRef.current);
        gl!.viewport(0, 0, canvas.width, canvas.height);
        gl!.clearColor(0, 0, 0, 0);
        gl!.clear(gl!.COLOR_BUFFER_BIT);
        gl!.useProgram(program);
        gl!.bindBuffer(gl!.ARRAY_BUFFER, positionBuffer);
        gl!.bufferData(
          gl!.ARRAY_BUFFER,
          new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
          gl!.STATIC_DRAW,
        );
        gl!.enableVertexAttribArray(positionLocation);
        gl!.vertexAttribPointer(positionLocation, 2, gl!.FLOAT, false, 0, 0);
        gl!.activeTexture(gl!.TEXTURE0);
        gl!.bindTexture(gl!.TEXTURE_2D, texture);
        gl!.uniform1i(sourceLocation, 0);
        gl!.uniform2f(resolutionLocation, canvas.width, canvas.height);
        gl!.uniform1f(barrelLocation, parameters.barrel);
        gl!.uniform1f(channelOffsetLocation, parameters.channelOffset);
        gl!.uniform1f(intensityLocation, parameters.intensity);
        gl!.drawArrays(gl!.TRIANGLE_STRIP, 0, 4);
      };

      resizeAndPaint();
      renderRef.current = render;
      render();
      resizeObserver = new ResizeObserver(() => {
        resizeAndPaint();
        render();
      });
      resizeObserver.observe(host);
      setRendererState(canvas, 'webgl');

      return () => {
        disposed = true;
        renderRef.current = null;
        resizeObserver?.disconnect();
        gl?.deleteBuffer(positionBuffer);
        gl?.deleteTexture(texture);
        gl?.deleteProgram(program);
      };
    } catch {
      renderRef.current = null;
      setRendererState(canvas, 'fallback');
      return () => resizeObserver?.disconnect();
    }
  }, [text]);

  return (
    <canvas
      ref={canvasRef}
      data-testid="landing-crt-shader"
      data-crt-renderer="pending"
      data-crt-progress={clampUnit(progress)}
      className="mapflow-story__crt-shader"
      aria-hidden="true"
    />
  );
}

export { CRT_FRAGMENT_SHADER, getCrtEffectParameters };
