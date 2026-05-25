require('dotenv').config();
const {
    Client,
    GatewayIntentBits,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
    SlashCommandBuilder,
    REST,
    Routes
} = require('discord.js');

const VERIFIED_ROLE_ID = "PUT_ROLE_ID_HERE";

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.DirectMessages
    ],
    partials: ["CHANNEL"]
});

const pendingVerifications = new Map();

/* ─────────────────────────────
   SLASH COMMAND SETUP
───────────────────────────── */
const commands = [
    new SlashCommandBuilder()
        .setName('verify-panel')
        .setDescription('Open staff verification panel')
        .toJSON()
];

const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

/* ─────────────────────────────
   READY EVENT
───────────────────────────── */
client.once('ready', async () => {
    console.log(`🏛️ Archive Bot Online as ${client.user.tag}`);

    try {
        await rest.put(
            Routes.applicationCommands(client.user.id),
            { body: commands }
        );
        console.log("✅ Slash commands registered");
    } catch (err) {
        console.error(err);
    }
});

/* ─────────────────────────────
   MESSAGE HANDLER
───────────────────────────── */
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    const userId = message.author.id;

    // 🏓 TEST
    if (message.content === '!ping') {
        return message.reply('🏛️ Archive Core Online.');
    }

    /* ────────────────
       VERIFY START
    ──────────────── */
    if (message.content === '!verify') {
        pendingVerifications.set(userId, { step: 1, answers: [] });

        message.author.send(
`🏛️ **Archive Verification Started**

Step 1 of 2:

What brings you to Tabletop RPG Realms of Fantasy?
(Example: Power Rangers RPG, D&D resources, map tools, etc.)

Reply with your answer.`
        ).catch(() => {
            message.reply("Please enable DMs so I can verify you.");
        });

        return message.reply("📨 Check your DMs to complete verification.");
    }

    /* ────────────────
       DM QUESTION FLOW
    ──────────────── */
    if (message.channel.type === 1 && pendingVerifications.has(userId)) {

        const data = pendingVerifications.get(userId);

        const staffChannel = message.guild?.channels?.cache.find(
            c => c.name === "verification-logs"
        );

        // STEP 1 RESPONSE
        if (data.step === 1) {

            data.answers.push(message.content);
            data.step = 2;

            pendingVerifications.set(userId, data);

            return message.reply(
`Step 2 of 2:

What tabletop systems are you most interested in?
(Examples: D&D 5e, Power Rangers RPG, Cyberpunk RED, homebrew systems)

Reply with your answer.`
            );
        }

        // STEP 2 RESPONSE (FINAL SUBMISSION)
        if (data.step === 2) {

            data.answers.push(message.content);

            if (staffChannel) {
                staffChannel.send(
`📥 **NEW VERIFICATION REQUEST**

👤 User: ${message.author.tag}
🆔 ID: ${message.author.id}

🎯 Interest:
${data.answers[0]}

🎲 Systems:
${data.answers[1]}`
                );
            }

            pendingVerifications.delete(userId);

            return message.reply(
`✅ Your verification is complete.

🕒 Staff will review your request soon.
🏛️ Please wait for approval from the archive team.`
            );
        }
    }

    /* ────────────────
       STAFF COMMANDS
    ──────────────── */

    if (message.content.startsWith('!approve')) {
        if (!message.member.permissions.has('Administrator')) {
            return message.reply("❌ No permission.");
        }

        const user = message.mentions.members.first();
        if (!user) return message.reply("❌ Mention a user.");

        user.roles.add(VERIFIED_ROLE_ID);

        return message.channel.send(`🟢 ${user.user.tag} has been VERIFIED.`);
    }

    if (message.content.startsWith('!deny')) {
        if (!message.member.permissions.has('Administrator')) {
            return message.reply("❌ No permission.");
        }

        const user = message.mentions.members.first();
        if (!user) return message.reply("❌ Mention a user.");

        return message.channel.send(`🔴 ${user.user.tag} has been denied.`);
    }

    if (message.content === '!pending') {
        if (!message.member.permissions.has('Administrator')) {
            return message.reply("❌ No permission.");
        }

        return message.channel.send("📥 Check #verification-logs for pending requests.");
    }
});

/* ─────────────────────────────
   SLASH PANEL
───────────────────────────── */
client.on('interactionCreate', async (interaction) => {

    if (interaction.isChatInputCommand()) {

        if (interaction.commandName === 'verify-panel') {

            if (!interaction.member.permissions.has('Administrator')) {
                return interaction.reply({
                    content: "❌ No permission.",
                    ephemeral: true
                });
            }

            const embed = new EmbedBuilder()
                .setTitle("🏛️ Verification Control Panel")
                .setDescription("Manual archive verification controls.")
                .setColor(0x00AEFF);

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('approve_user')
                    .setLabel('Approve')
                    .setStyle(ButtonStyle.Success),

                new ButtonBuilder()
                    .setCustomId('deny_user')
                    .setLabel('Deny')
                    .setStyle(ButtonStyle.Danger)
            );

            return interaction.reply({
                embeds: [embed],
                components: [row],
                ephemeral: true
            });
        }
    }

    if (interaction.isButton()) {

        if (!interaction.member.permissions.has('Administrator')) {
            return interaction.reply({
                content: "❌ No permission.",
                ephemeral: true
            });
        }

        if (interaction.customId === 'approve_user') {
            return interaction.reply({
                content: "🟢 Approved (manual assignment still required).",
                ephemeral: true
            });
        }

        if (interaction.customId === 'deny_user') {
            return interaction.reply({
                content: "🔴 Denied.",
                ephemeral: true
            });
        }
    }
});

/* ─────────────────────────────
   LOGIN
───────────────────────────── */
client.login(process.env.TOKEN);
