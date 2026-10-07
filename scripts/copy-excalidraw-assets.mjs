import { cp, mkdir } from 'node:fs/promises';

const destination = new URL('../public/excalidraw/fonts/', import.meta.url);
await mkdir(destination, { recursive: true });
await cp(new URL('../node_modules/@excalidraw/excalidraw/dist/prod/fonts/', import.meta.url), destination, { recursive: true });
