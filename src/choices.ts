import type { ChoicesOptions } from "./types.js";

export function choices(options?: ChoicesOptions): string {
    console.log(options?.mode);
    return "hello world";
}