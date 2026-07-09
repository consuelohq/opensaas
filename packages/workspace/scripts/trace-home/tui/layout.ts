export function terminalSize(stdout: NodeJS.WriteStream = process.stdout): { width: number; height: number } { return { width: stdout.columns || 151, height: stdout.rows || 44 }; }
