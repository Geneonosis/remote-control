import "dotenv/config";
import { runCommand, listCommands } from "./agent-core";

async function main() {
  const [, , subcommand, ...args] = process.argv;

  if (!subcommand || subcommand === "help" || subcommand === "--help") {
    console.log(
      `Usage: \n agent-cli list\n agent-cli run <commandId> \n Examples:\n agent-cli list\n agent-cli run open-notepad`
    );
    process.exit(0);
  }

  if (subcommand === "list") {
    const commands = listCommands();
    if (commands.length === 0) {
      console.log("No commands defined.");
      return;
    }
    console.log("Available commands:");
    for (const { id, command } of commands) {
      console.log(`- ${id}: ${command}`);
    }
    return;
  }

  if (subcommand === "run") {
    const commandId = args[0];
    if (!commandId) {
      console.error("Error: missing <commandId>");
      process.exit(1);
    }

    const result = await runCommand(commandId);
    console.log(`CommandId: ${result.commandId}`);
    console.log(`Success: ${result.success}`);
    console.log(`---- STDOUT ----`);
    process.stdout.write(result.stdout || "<empty>\n");
    console.log(`---- STDERR ----`);
    process.stderr.write(result.stderr || "<empty>\n");

    process.exit(result.success ? 0 : 1);
  }

  console.error(`Unknown subcommand: ${subcommand}`);
  process.exit(1);
}

main().catch((err) => {
  console.error("Fatal error in agent-cli:", err);
  process.exit(1);
});
