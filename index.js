client.on('messageCreate', async (message) => {

  // ❌ ignore bots
  if (message.author.bot) return;

  const userId = message.author.id;

  // =========================
  // 🟢 START VERIFY FLOW
  // =========================
  if (message.content === '!verify') {

    dmProgress.set(userId, {
      step: 1,
      answers: {}
    });

    try {
      await message.author.send("🧠 Verification started. What is your name?");
      await message.reply("📩 Check your DMs to continue verification.");
    } catch (err) {
      await message.reply("❌ I can't DM you. Please enable DMs from server members.");
    }

    return;
  }

  // =========================
  // 🔒 DM FLOW ONLY
  // =========================
  if (message.channel.type !== 1) return;

  if (!dmProgress.has(userId)) return;

  const progress = dmProgress.get(userId);

  // STEP 1
  if (progress.step === 1) {
    progress.answers.name = message.content;
    progress.step = 2;

    dmProgress.set(userId, progress);
    return message.channel.send("📅 What is your age?");
  }

  // STEP 2
  if (progress.step === 2) {
    progress.answers.age = message.content;
    progress.step = 3;

    dmProgress.set(userId, progress);
    return message.channel.send("🎮 What is your experience level?");
  }

  // STEP 3 (FINAL)
  if (progress.step === 3) {
    progress.answers.experience = message.content;

    pendingQueue.set(userId, {
      userId,
      answers: progress.answers,
      timestamp: Date.now()
    });

    dmProgress.delete(userId);

    await message.channel.send("✅ Application submitted! Staff will review it soon.");

    const logChannel = client.channels.cache.get(LOG_CHANNEL_ID);
    if (logChannel) {
      logChannel.send(`📥 New application from <@${userId}>`);
    }
  }
});
