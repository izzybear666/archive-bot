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

/* ─────────────────────────────
   CONFIG
───────────────────────────── */
const VERIFIED_ROLE_ID = "PUT_ROLE_ID_HERE";
const VERIFICATION_LOG_CHANNEL_ID = "PUT_CHANNEL_ID_HERE";

/* ─────────────────────────────
   CLIENT
───────────────────────────── */
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

/* ─────────────────────────────
   STORAGE
───────────────────────────── */
const pendingVerifications = new Map();
const verificationQueue = new Map();

/* ─────────────────────────────
   SLASH COMMANDS
───────────────────────────── */
const commands = [
    new SlashCommandBuilder()
        .setName('verify-panel')
        .setDescription('Open staff verification panel')
        .toJSON(),

    new SlashCommandBuilder()
        .setName('queue')
        .setDescription('View verification queue')
        .toJSON()
];

const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

/* ─────────────────────────────
   READY
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
   MESSAGE SYSTEM
───────────────────────────── */
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    const userId = message.author.id;

    // 🏓 TEST
    if (message.content === '!ping') {
        return message.reply('🏛️ Archive Core Online.');
    }

    /* ───────── VERIFY START ───────── */
    if (message.content === '!verify') {
        pendingVerifications.set(userId, { step: 1, answers: [] });

        try {
            await message.author.send(
`🏛️ **Archive Verification Started**

STEP 1:
What brings you to Tabletop RPG Realms of Fantasy?

Reply with your answer.`
            );

            message.reply("📨 Check your DMs to continue verification.");
        } catch {
            message.reply("❌ Please enable DMs.");
        }

        return;
    }

    /* ───────── DM FLOW ───────── */
    if (message.channel.type === 1 && pendingVerifications.has(userId)) {

        const data = pendingVerifications.get(userId);
        const staffChannel = await client.channels.fetch(VERIFICATION_LOG_CHANNEL_ID);

        // STEP 1
        if (data.step === 1) {
            data.answers.push(message.content);
            data.step = 2;
            pendingVerifications.set(userId, data);

            return message.reply(
`STEP 2:
What tabletop systems are you interested in?`
            );
        }

        // FINAL STEP
        if (data.step === 2) {
            data.answers.push(message.content);

            // SAVE TO QUEUE
            verificationQueue.set(userId, {
                tag: message.author.tag,
                id: message.author.id,
                answers: data.answers
            });

            pendingVerifications.delete(userId);

            if (staffChannel) {
                staffChannel.send(
`📥 **NEW VERIFICATION REQUEST**

👤 User: ${message.author.tag}
🆔 ID: ${message.author.id}

🎯 Interest:
${data.answers[0]}

🎲 Systems:
${data.answers[1]}

🟡 Status: PENDING`
                );
            }

            return message.reply(
`✅ Submitted to staff queue.
Please wait for approval.`
            );
        }
    }

    /* ───────── STAFF COMMANDS ───────── */

    if (message.content.startsWith('!approvequeue')) {
        if (!message.member.permissions.has('Administrator')) {
            return message.reply("❌ No permission.");
        }

        const userId = message.content.split(" ")[1];
        const member = await message.guild.members.fetch(userId).catch(() => null);

        if (!member) return message.reply("❌ User not found.");

        await member.roles.add(VERIFIED_ROLE_ID);
        verificationQueue.delete(userId);

        return message.channel.send(`🟢 Approved + Verified.`);
    }

    if (message.content.startsWith('!denyqueue')) {
        if (!message.member.permissions.has('Administrator')) {
            return message.reply("❌ No permission.");
        }

        const userId = message.content.split(" ")[1];

        verificationQueue.delete(userId);

        return message.channel.send(`🔴 Removed from queue.`);
    }
});

/* ─────────────────────────────
   SLASH + PANEL SYSTEM
───────────────────────────── */
client.on('interactionCreate', async (interaction) => {

    /* ───── VERIFY PANEL ───── */
    if (interaction.isChatInputCommand()) {

        if (interaction.commandName === 'verify-panel') {

            if (!interaction.member.permissions.has('Administrator')) {
                return interaction.reply({ content: "❌ No permission.", ephemeral: true });
            }

            const embed = new EmbedBuilder()
                .setTitle("🏛️ Verification Panel")
                .setDescription("Staff control system")
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

        /* ───── QUEUE VIEW ───── */
        if (interaction.commandName === 'queue') {

            if (!interaction.member.permissions.has('Administrator')) {
                return interaction.reply({ content: "❌ No permission.", ephemeral: true });
            }

            if (verificationQueue.size === 0) {
                return interaction.reply({ content: "📭 Queue empty.", ephemeral: true });
            }

            let output = "📥 VERIFICATION QUEUE\n\n";

            verificationQueue.forEach((data) => {
                output +=
`👤 ${data.tag}
🆔 ${data.id}
🎯 ${data.answers[0]}
🎲 ${data.answers[1]}

-----------------\n`;
            });

            return interaction.reply({ content: output, ephemeral: true });
        }
    }

    /* ───── BUTTONS ───── */
    if (interaction.isButton()) {

        if (!interaction.member.permissions.has('Administrator')) {
            return interaction.reply({ content: "❌ No permission.", ephemeral: true });
        }

        if (interaction.customId === 'approve_user') {
            return interaction.reply({
                content: "🟢 Approved (manual assignment via queue still available).",
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
