// Ven's Dont Ping Me Bot 

const {Client, GetwayIntentBits, Events } = require("discord.js");

// Bot Settings

const TOKEN = ""; // Bot token goes this line
const PROTECTED_USER_IDS = [""]; // Enter the IDs of the users who are not allowed to be pinged in server. 
const PROTECTED_ROLE_IDS = [""]; // Enter the IDs of the roles that are forbidden from being pinged in server.
const EXEMPT_ROLE_IDS =  [""]; // Enter the IDs of the roles you want to allow to be mentioned here
const TIMEOUT_STEPS = [0, 1 * 60 * 1000, 10 * 60 * 1000]; // The sequence of penalties is: first, a warning; second, a 1-minute timeout; and finally, a 10-minute timeout.
const RESET_AFTER_MS = 10 * 60 * 1000; // After how many milliseconds should the penalty counter be reset following the first penalty?
const WARNING_DELETE_AFTER_MS = 15 * 1000; // Duration before a warning message is deleted. (milliseconds)

//
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildsMessages,
        GatewayIntentBits.GuildsMembers,
        GatewayIntentBits.MessageContent,
    ],
});

const violations = new Map();

function pingedProtected(message) {
    const userHit = message.mentions.users.some((u) =>
      PROTECTED_USER_IDS.includes(u.id)  
    );
    const roleHit = message.mentions.roles.some((r) =>
        PROTECTED_ROLE_IDS.includes(r.id)
    );
    return userHit || roleHit;
}

function nextOffense(guildId, userId) {
    const key = `${guildId}-${userId}`;
    const now = Date.now();
    const entry = violations.get(key) || { count : 0, last: 0};

    if (now - entry.last > RESET_AFTER_MS) entry.count = 0;

    entry.count += 1;
    entry.last = now;
    violations.set(key, entry);
    return entry.count;
}

client.once(Events.ClientReady, (c) => {
    console.log(`Logged in as ${c.user.tag} .`);
});

client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot || !message.guild) return;
    if (!pingedProtected(message)) return;

    const author = message.author;

    if (PROTECTED_USER_IDS.includes(author.id)) return; 

    const member = 
        message.member ?? (await message.guild.members.fetch(author.id).catch(() => null));
    if (!member) return;

    if (member.roles.cache.some((r) => EXEMPT_ROLE_IDS.includes(r.id))) return; 

    const count = nextOffense(message.guild.id, author.id);
    const level = Math.min(count, TIMEOUT_STEPS.length);
    const duration = TIMEOUT_STEPS[level - 1];

    await message.delete().catch(() => {});

    let timeoutFailed = false;
    if (duration > 0) {
        try {
            await member.timeout(duration, `Protected role or person ping (ihlal #${count})`);
        } catch {
            timeoutFailed = true;
        }
    }

    let text;
    if (duration == 0) {
        text = `${author} Pinging this person or role is prohibited!`;
    } else {
        const minutes = duration / 60000;
        text = `${author} You’ve been timed out for **${minutes} minutes** for pinging again. (Violation: ${count})`;
        if (timeoutFailed) {
            text += "\n(Could not apply timeout; check the bot's permissions or its position in the role hierarchy.)"
        }
    }

    const warning = await message.channel
        .send({content: text, allowedMentions: { users: [author.id] } })
        .catch(() => null);

    if (warning && WARNING_DELETE_AFTER_MS) {
        setTimeout(() => warning.delete().catch(() => {}), WARNING_DELETE_AFTER_MS);
    }

});

client.login(TOKEN);