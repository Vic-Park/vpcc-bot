// Registers slash commands with Discord

require("dotenv").config();

const { SlashCommandBuilder } = require("@discordjs/builders");
const { REST } = require("@discordjs/rest");
const { Routes } = require("discord-api-types/v9");

const commands = [
	new SlashCommandBuilder()
		.setName("ping")
		.setDescription("Replies with pong"),
	new SlashCommandBuilder()
		.setName("admin")
		.setDescription("Bot owner only commands")
		.addSubcommand(subcommand => subcommand
			.setName("get")
			.setDescription("Retrieves a resource's property")
			.addStringOption(option => option
				.setName("key")
				.setDescription("Resource and property to locate")
				.setRequired(true)))
		.addSubcommand(subcommand => subcommand
			.setName("set")
			.setDescription("Updates a resource's property")
			.addStringOption(option => option
				.setName("key")
				.setDescription("Resource and property to locate")
				.setRequired(true))
			.addStringOption(option => option
				.setName("value")
				.setDescription("New value")
				.setRequired(true)))
		.addSubcommand(subcommand => subcommand
			.setName("invalidate")
			.setDescription("Invalidates the cache")),
	new SlashCommandBuilder()
		.setName("profile")
		.setDescription("Shows a summary of your profile")
		.addStringOption(option => option
			.setName("type")
			.setDescription("The type of summary to show")
			.setRequired(false)
			.addChoice("user", "user")
			.addChoice("medals", "medals")
			.addChoice("points", "points")
			.addChoice("team", "team")),
	new SlashCommandBuilder()
		.setName("team")
		.setDescription("Manage teams")
		.addSubcommand(subcommand => subcommand
			.setName("create")
			.setDescription("Creates and joins a new team")
			.addStringOption(option => option
				.setName("name")
				.setDescription("Name of team")
				.setRequired(true)))
		.addSubcommand(subcommand => subcommand
			.setName("join")
			.setDescription("Joins a team")
			.addStringOption(option => option
				.setName("name")
				.setDescription("Name of team")
				.setRequired(true)))
		.addSubcommand(subcommand => subcommand
			.setName("leave")
			.setDescription("Leaves your team and destroys it if empty"))
		.addSubcommand(subcommand => subcommand
			.setName("rename")
			.setDescription("Renames your team")
			.addStringOption(option => option
				.setName("name")
				.setDescription("Name of team")
				.setRequired(true))),
	new SlashCommandBuilder()
		.setName("leaderboard")
		.setDescription("Shows the leaderboard with the top teams"),
	new SlashCommandBuilder()
		.setName("points")
		.setDescription("Manages points")
		.addSubcommand(subcommand => subcommand
			.setName("give-team")
			.setDescription("Gives a team a specified number of points")
			.addStringOption(option => option
				.setName("name")
				.setDescription("Name of team")
				.setRequired(true))
			.addIntegerOption(option => option
				.setName("points")
				.setDescription("Amount of points to give")
				.setRequired(true)))
		.addSubcommand(subcommand => subcommand
			.setName("give-voice")
			.setDescription("Gives all teams with at least one member in a voice channel a specified number of points")
			.addChannelOption(option => option
				.setName("name")
				.setDescription("Voice channel to target")
				.setRequired(true))
			.addIntegerOption(option => option
				.setName("points")
				.setDescription("Amount of points to give")
				.setRequired(true))),
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
