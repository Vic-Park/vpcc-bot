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
		const type = interaction.options.getString("type") || "user";
		await interaction.reply(`haha lol ${type}`);
		return;
	}

	if (interaction.commandName === "team") {
		const subcommandName = interaction.options.getSubcommand(true);
		if (subcommandName === "join") {
			const name = interaction.options.getString("name", true);
			await interaction.reply(`haha lol team join ${name}`);
			return;
		}
		if (subcommandName === "leave") {
			await interaction.reply("haha lol team leave");
			return;
		}
		if (subcommandName === "rename") {
			const name = interaction.options.getString("name", true);
			await interaction.reply(`haha lol team rename ${name}`);
			return;
		}
	}

	if (interaction.commandName === "leaderboard") {
		const type = interaction.options.getString("type") || "normal";
		await interaction.reply("haha lol leaderboard");
		return;
	}

	if (interaction.commandName === "points") {
		const subcommandName = interaction.options.getSubcommand(true);
		if (subcommandName === "give-team") {
			const name = interaction.options.getString("name", true);
			const points = interaction.options.getInteger("points", true);
			await interaction.reply(`haha lol team join ${name} ${points}`);
			return;
		}
		if (subcommandName === "give-voice") {
			const channel = interaction.options.getString("channel", true);
			const points = interaction.options.getInteger("points", true);
			await interaction.reply(`haha lol team join ${channel} ${points}`);
			return;
		}
	}
});

client.login(process.env.BOT_TOKEN);
