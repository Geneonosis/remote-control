// agent-core.ts
import { exec } from "child_process";

export type CommandId = string;

export type CommandResult = {
  type: "RESULT";
  requestId?: string; // optional in standalone mode
  commandId: CommandId;
  success: boolean;
  stdout: string;
  stderr: string;
};

// Central place to define all commands the agent knows
export const COMMAND_MAP: Record<CommandId, string> = {
  "open-notepad": "notepad.exe",
  // add more here as you go
};

export function listCommands(): { id: string; command: string }[] {
  return Object.entries(COMMAND_MAP).map(([id, command]) => ({ id, command }));
}

export function runCommand(
  commandId: CommandId,
  requestId?: string
): Promise<CommandResult> {
  return new Promise((resolve) => {
    const cmd = COMMAND_MAP[commandId];

    if (!cmd) {
      // Unknown command – don’t crash, just return a Result
      const result: CommandResult = {
        type: "RESULT",
        requestId,
        commandId,
        success: false,
        stdout: "",
        stderr: `Unknown commandId: ${commandId}`,
      };
      return resolve(result);
    }

    console.log(`Running command "${commandId}" -> "${cmd}"`);

    exec(cmd, (error, stdout, stderr) => {
      const result: CommandResult = {
        type: "RESULT",
        requestId,
        commandId,
        success: !error,
        stdout: stdout ?? "",
        stderr: (stderr ?? "") || (error ? error.message : ""),
      };

      console.log(
        `Command "${commandId}" finished; success=${result.success}, stdout length=${result.stdout.length}, stderr length=${result.stderr.length}`
      );

      resolve(result);
    });
  });
}
