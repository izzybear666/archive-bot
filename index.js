require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');

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

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    const userId = message.author.id;

    // 🏓 test command
    if (message.content === '!ping') {
        message.reply('🏛️ Archive Core Online.');
    }

    // 🔐 verify command
    if (message.content === '!verify') {
        pendingVerifications.set(userId, true);

        message.author.send(
            "🏛️ **Archive Verification Started**\n\n" +
            "What brings you to Tabletop RPG Realms of Fantasy?\n\n" +
            "Reply here with your answer."
        ).catch(() => {
            message.reply("Please enable DMs so I can verify you.");
        });

        message.reply("📨 Check your DMs to complete verification.");
    }

    // 📩 handle DM response
    if (message.channel.type === 1 && pendingVerifications.has(userId)) {
        const staffChannel = client.channels.cache.find(
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

        message.reply("✅ Thank you. Your request has been submitted for review.");
    }
});

client.login(process.env.TOKEN);
