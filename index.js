// Runs the VPCC-Bot

require("dotenv").config();

const { Client, Intents } = require("discord.js");
const client = new Client({ intents: [ Intents.FLAGS.GUILDS ] });

client.on("ready", () => {
	console.log(`Logged in as ${client.user.tag}`);
});

client.on("interactionCreate", async interaction => {
	if (!interaction.isCommand())
		return;

	if (interaction.commandName === "ping") {
		await interaction.reply("pong");
		return;
	}

	if (interaction.commandName === "profile") {
		const type = interaction.options.getString("type") || "normal";
		await interaction.reply(`haha lol ${type}`);
		return;
	}
});

client.login(process.env.BOT_TOKEN);
