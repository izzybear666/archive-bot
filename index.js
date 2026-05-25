require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');

const VERIFIED_ROLE_ID = "PUT_ROLE_ID_HERE";

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

const pendingVerifications = new Map();

client.once('ready', () => {
    console.log(`🏛️ Archive Bot Online as ${client.user.tag}`);
});

// ─────────────────────────────
// BASIC TEST COMMAND
// ─────────────────────────────
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    const userId = message.author.id;

    if (message.content === '!ping') {
        return message.reply('🏛️ Archive Core Online.');
    }

    // ─────────────────────────────
    // USER VERIFICATION SYSTEM
    // ─────────────────────────────
    if (message.content === '!verify') {
        pendingVerifications.set(userId, true);

        message.author.send(
            "🏛️ **Archive Verification Started**\n\n" +
            "What brings you to Tabletop RPG Realms of Fantasy?\n\n" +
            "Reply here with your answer."
        ).catch(() => {
            message.reply("Please enable DMs so I can verify you.");
        });

        return message.reply("📨 Check your DMs to complete verification.");
    }

    // Handle DM response
    if (message.channel.type === 1 && pendingVerifications.has(userId)) {
        const staffChannel = message.guild?.channels?.cache.find(
            c => c.name === "verification-logs"
        );

        if (staffChannel) {
            staffChannel.send(
                `📥 **New Verification Request**\n\n` +
                `User: ${message.author.tag}\n` +
                `Answer: ${message.content}`
            );
        }

        pendingVerifications.delete(userId);

        return message.reply(
            "✅ Your verification request has been sent to staff.\n" +
            "🕒 Please wait for manual approval from the archive team."
        );
    }

    // ─────────────────────────────
    // STAFF COMMANDS
    // ─────────────────────────────

    // APPROVE USER
    if (message.content.startsWith('!approve')) {
        if (!message.member.permissions.has('Administrator')) {
            return message.reply("❌ You don't have permission.");
        }

        const user = message.mentions.members.first();
        if (!user) return message.reply("❌ Mention a user.");

        user.roles.add(VERIFIED_ROLE_ID);

        return message.channel.send(`🟢 ${user.user.tag} has been VERIFIED.`);
    }

    // DENY USER
    if (message.content.startsWith('!deny')) {
        if (!message.member.permissions.has('Administrator')) {
            return message.reply("❌ You don't have permission.");
        }

        const user = message.mentions.members.first();
        if (!user) return message.reply("❌ Mention a user.");

        return message.channel.send(`🔴 ${user.user.tag} has been denied access.`);
    }

    // PENDING CHECK
    if (message.content === '!pending') {
        if (!message.member.permissions.has('Administrator')) {
            return message.reply("❌ You don't have permission.");
        }

        return message.channel.send("📥 Check #verification-logs for pending requests.");
    }
});

client.login(process.env.TOKEN);
