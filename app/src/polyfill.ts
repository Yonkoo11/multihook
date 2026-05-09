// Side-effect-only module: makes Node's Buffer available on window before any
// browser-incompatible Solana dep tries to read it during its own init.
// Import THIS first in main.ts before importing any @solana/* package.
import { Buffer } from "buffer";
(window as any).Buffer = Buffer;
(window as any).global = window;
