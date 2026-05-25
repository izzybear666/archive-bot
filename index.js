const {
  Client,
  GatewayIntentBits,
  Partials,
  SlashCommandBuilder,
  Routes,
  REST,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require('discord.js');

// ========================
// CONFIG
// ========================
const TOKEN = "YOUR_BOT_TOKEN";
const CLIENT_ID = "YOUR_CLIENT_ID";
const GUILD_ID = "YOUR_GUILD_ID";

const VERIFIED_ROLE_ID = "YOUR_ROLE_ID_HERE";
const LOG_CHANNEL_ID = "YOUR_LOG_CHANNEL_ID_HERE";

// ========================
// CLIENT
// ========================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Channel]
});

// ========================
// QUEUE STORAGE
// ========================
const pendingQueue = new Map();

// Temporary DM storage per user
const dmProgress = new Map();

// ========================
// REGISTER SLASH COMMAND
// ========================
const commands = [
  new SlashCommandBuilder()
    .setName('queue')
    .setDescription('View pending verification queue')
    .toJSON()
];

const rest = new REST({ version: '10' }).setToken(TOKEN);

(async () => {
  try {
    await rest.put(
      Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
      { body: commands }
    );
    console.log("Slash commands registered");
  } catch (err) {
    console.error(err);
  }
})();

// ========================
// START VERIFY FLOW (EXAMPLE TRIGGER)
// ========================
client.on('messageCreate', async (message) => {
  if (message.content === '!verify') {
    const userId = message.author.id;

    dmProgress.set(userId, {
      step: 1,
      answers: {}
    });

    await message.author.send("🧠 Verification started. What is your name?");
  }
});

// ========================
// DM FLOW HANDLER
// ========================
client.on('messageCreate', async (message) => {
  if (message.channel.type !== 1) return; // DM only

  const userId = message.author.id;

  if (!dmProgress.has(userId)) return;

  const progress = dmProgress.get(userId);

  // Step 1
  if (progress.step === 1) {
    progress.answers.name = message.content;
    progress.step = 2;

    dmProgress.set(userId, progress);
    return message.channel.send("📅 What is your age?");
  }

  // Step 2
  if (progress.step === 2) {
    progress.answers.age = message.content;
    progress.step = 3;

    dmProgress.set(userId, progress);
    return message.channel.send("🎮 What is your experience level?");
  }

  // Step 3 (FINAL)
  if (progress.step === 3) {
    progress.answers.experience = message.content;

    // MOVE TO QUEUE
    pendingQueue.set(userId, {
      userId,
      answers: progress.answers,
      timestamp: Date.now()
    });

    dmProgress.delete(userId);

    message.channel.send("✅ Application submitted! Staff will review it soon.");

    // OPTIONAL LOG
    const logChannel = client.channels.cache.get(LOG_CHANNEL_ID);
    if (logChannel) {
      logChannel.send(`📥 New application from <@${userId}>`);
    }
  }
});

// ========================
// /QUEUE COMMAND
// ========================
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'queue') {

    if (pendingQueue.size === 0) {
      return interaction.reply({ content: "📭 No pending applications.", ephemeral: true });
    }

    const first = [...pendingQueue.values()][0];

    const embed = new EmbedBuilder()
      .setTitle("🧠 Verification Queue")
      .setDescription(`User: <@${first.userId}>`)
      .addFields(
        Object.entries(first.answers).map(([k, v]) => ({
          name: k.toUpperCase(),
          value: v.toString()
        }))
      )
      .setFooter({ text: `User ID: ${first.userId}` });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`approve_${first.userId}`)
        .setLabel("Approve")
        .setStyle(ButtonStyle.Success),

      new ButtonBuilder()
        .setCustomId(`deny_${first.userId}`)
        .setLabel("Deny")
        .setStyle(ButtonStyle.Danger)
    );

    return interaction.reply({ embeds: [embed], components: [row] });
  }
});

// ========================
// BUTTON HANDLER
// ========================
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isButton()) return;

  const [action, userId] = interaction.customId.split('_');

  const guild = interaction.guild;
  const member = await guild.members.fetch(userId).catch(() => null);

  if (!member) {
    return interaction.reply({ content: "User not found.", ephemeral: true });
  }

  if (action === 'approve') {

    await member.roles.add(VERIFIED_ROLE_ID);
    pendingQueue.delete(userId);

    const logChannel = client.channels.cache.get(LOG_CHANNEL_ID);
    if (logChannel) {
      logChannel.send(`🟢 Approved <@${userId}>`);
    }

    return interaction.reply({
      content: `🟢 Approved <@${userId}>`,
      ephemeral: true
    });
  }

  if (action === 'deny') {

    pendingQueue.delete(userId);

    const logChannel = client.channels.cache.get(LOG_CHANNEL_ID);
    if (logChannel) {
      logChannel.send(`🔴 Denied <@${userId}>`);
    }

    return interaction.reply({
      content: `🔴 Denied <@${userId}>`,
      ephemeral: true
    });
  }
});

// ========================
// LOGIN
// ========================
client.login(TOKEN);
