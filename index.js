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
const GUILD_ID = "PUT_SERVER_ID_HERE";

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
   DATA STORAGE
───────────────────────────── */
const pendingVerifications = new Map();
const verificationQueue = [];

/* ─────────────────────────────
   SLASH COMMAND SETUP
───────────────────────────── */
const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

/* ─────────────────────────────
   READY EVENT + SLASH REGISTER
───────────────────────────── */
client.once('ready', async () => {
    console.log(`🏛️ Archive Bot Online as ${client.user.tag}`);

    try {
        await rest.put(
            Routes.applicationGuildCommands(client.user.id, GUILD_ID),
            {
                body: [
                    new SlashCommandBuilder()
                        .setName('queue')
                        .setDescription('View verification queue')
                        .toJSON()
                ]
            }
        );

        console.log("✅ Slash commands registered (GUILD MODE)");
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

    /* ───── VERIFY START ───── */
    if (message.content === '!verify') {

        pendingVerifications.set(userId, { step: 1, answers: [] });

        try {
            await message.author.send(
`🏛️ **Archive Verification Started**

STEP 1:
What brings you to Tabletop RPG Realms of Fantasy?

(Examples: Power Rangers RPG, D&D resources, maps, homebrew systems)

Reply with your answer.`
            );

            message.reply("📨 Check your DMs.");
        } catch {
            message.reply("❌ Enable DMs.");
        }

        return;
    }

    /* ───── DM FLOW ───── */
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
What systems are you interested in?
(D&D, Power Rangers RPG, Cyberpunk RED, etc.)`
            );
        }

        // FINAL STEP
        if (data.step === 2) {
            data.answers.push(message.content);

            // ADD TO QUEUE
            verificationQueue.push({
                id: message.author.id,
                tag: message.author.tag,
                answers: [...data.answers]
            });

            // LOG CHANNEL
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
`✅ Submitted to staff queue.
🏛️ Please wait for approval.`
            );
        }
    }
});

/* ─────────────────────────────
   SLASH COMMANDS
───────────────────────────── */
client.on('interactionCreate', async (interaction) => {

    if (!interaction.isChatInputCommand()) return;

    /* ───── /QUEUE (FIXED VERSION) ───── */
    if (interaction.commandName === 'queue') {

        if (!interaction.member.permissions.has('Administrator')) {
            return interaction.reply({
                content: "❌ No permission.",
                ephemeral: true
            });
        }

        // 🔥 FIX: prevents "Interaction Failed"
        await interaction.deferReply({ ephemeral: true });

        if (verificationQueue.length === 0) {
            return interaction.editReply("📭 Queue is empty.");
        }

        const user = verificationQueue[0];

        const embed = new EmbedBuilder()
            .setTitle("📥 Verification Queue")
            .setColor(0x00AEFF)
            .setDescription(
                `**User:** ${user.tag}\n\n` +
                `**Interest:** ${user.answers[0]}\n` +
                `**Systems:** ${user.answers[1]}`
            );

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('queue_approve')
                .setLabel('Approve')
                .setStyle(ButtonStyle.Success),

            new ButtonBuilder()
                .setCustomId('queue_deny')
                .setLabel('Deny')
                .setStyle(ButtonStyle.Danger),

            new ButtonBuilder()
                .setCustomId('queue_next')
                .setLabel('Next')
                .setStyle(ButtonStyle.Secondary)
        );

        return interaction.editReply({
            embeds: [embed],
            components: [row]
        });
    }

    /* ───── BUTTONS ───── */
    if (!interaction.isButton()) return;

    if (!interaction.member.permissions.has('Administrator')) {
        return interaction.reply({
            content: "❌ No permission.",
            ephemeral: true
        });
    }

    // APPROVE
    if (interaction.customId === 'queue_approve') {

        const user = verificationQueue.shift();
        if (!user) {
            return interaction.reply({
                content: "Queue empty.",
                ephemeral: true
            });
        }

        const member = await interaction.guild.members.fetch(user.id);
        await member.roles.add(VERIFIED_ROLE_ID);

        return interaction.reply({
            content: `🟢 Approved ${user.tag}`,
            ephemeral: true
        });
    }

    // DENY
    if (interaction.customId === 'queue_deny') {

        const user = verificationQueue.shift();
        if (!user) {
            return interaction.reply({
                content: "Queue empty.",
                ephemeral: true
            });
        }

        return interaction.reply({
            content: `🔴 Denied ${user.tag}`,
            ephemeral: true
        });
    }

    // NEXT
    if (interaction.customId === 'queue_next') {
        return interaction.deferUpdate();
    }
});

/* ─────────────────────────────
   LOGIN
───────────────────────────── */
client.login(process.env.TOKEN);
