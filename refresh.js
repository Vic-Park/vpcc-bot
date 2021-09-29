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
					{ name: "user", value: "user" },
					{ name: "medals", value: "medals" },
					{ name: "points", value: "points" },
					{ name: "team", value: "team" },
				],
			},
		],
	},
	{
		name: "team",
		description: "Manage teams",
		options: [
			{
				name: "join",
				description: "Joins a team and creates one if it doesn't exist",
				type: 1,  // SUB_COMMAND
				options: [
					{
						name: "name",
						description: "Name of team",
						type: 3,  // STRING
						required: true,
					},
				],
			},
			{
				name: "leave",
				description: "Leaves your team and destroys it if empty",
				type: 1,  // SUB_COMMAND
			},
			{
				name: "rename",
				description: "Renames your team",
				type: 1,  // SUB_COMMAND
				options: [
					{
						name: "name",
						description: "New name of team",
						type: 3,  // STRING
						required: true,
					},
				],
			},
		],
	},
	{
		name: "leaderboard",
		description: "Shows the leaderboard with the top teams",
	},
	{
		name: "points",
		description: "Manages points",
		options: [
			{
				name: "give-team",
				description: "Gives a team a specified number of points",
				type: 1,  // SUB_COMMAND
				options: [
					{
						name: "name",
						description: "Name of team",
						type: 3,  // STRING
						required: true,
					},
					{
						name: "points",
						description: "Amount of points to give",
						type: 4,  // INTEGER
						required: true,
					},
				],
			},
			{
				name: "give-voice",
				description: "Gives all teams with at least one member in a voice channel a specified number of points",
				type: 1,  // SUB_COMMAND
				options: [
					{
						name: "name",
						description: "Voice channel to target",
						type: 7,  // CHANNEL
						required: true,
					},
					{
						name: "points",
						description: "Amount of points to give",
						type: 4,  // INTEGER
						required: true,
					},
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
