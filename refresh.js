// Registers slash commands with Discord

require("dotenv").config();

const { REST } = require("@discordjs/rest");
const { Routes } = require("discord-api-types/v9");

const commands = [
	{
		name: "ping",
		description: "Replies with pong",
	},
	{
		name: "profile",
		description: "Shows a summary of your profile",
		options: [
			{
				name: "type",
				description: "The type of summary to show",
				type: 3,  // STRING
				required: false,
				choices: [
					{ name: "medals", value: "medals" },
					{ name: "points", value: "points" },
					{ name: "team", value: "team" },
				],
			},
		],
	},
];

const rest = new REST({ version: "9" }).setToken(process.env.BOT_TOKEN);

(async () => {
	try {
		console.log("Refreshing slash commands");
		await rest.put(
			Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
			{ body: commands },
		);
		console.log("Refreshed slash commands");
	} catch (error) {
		console.error(error);
	}
})();
