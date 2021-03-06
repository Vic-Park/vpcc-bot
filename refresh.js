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
			.setDescription("Invalidates the cache"))
		.addSubcommand(subcommand => subcommand
			.setName("add-to-team")
			.setDescription("Adds a user to a team")
			.addStringOption(option => option
				.setName("team")
				.setDescription("Team name or ID")
				.setRequired(true))
			.addUserOption(option => option
				.setName("member")
				.setDescription("Team member to add")
				.setRequired(true)))
		.addSubcommand(subcommand => subcommand
			.setName("remove-from-team")
			.setDescription("Removes a user from a team")
			.addStringOption(option => option
				.setName("team")
				.setDescription("Team name or ID")
				.setRequired(true))
			.addUserOption(option => option
				.setName("member")
				.setDescription("Team member to remove")
				.setRequired(true)))
		.addSubcommand(subcommand => subcommand
			.setName("create-team")
			.setDescription("Creates a team")
			.addUserOption(option => option
				.setName("member0")
				.setDescription("A team member")
				.setRequired(true))
			.addUserOption(option => option
				.setName("member1")
				.setDescription("A fellow member")
				.setRequired(true))
			.addUserOption(option => option
				.setName("member2")
				.setDescription("Another member")
				.setRequired(false))
			.addUserOption(option => option
				.setName("member3")
				.setDescription("Yet another member")
				.setRequired(false)))
		.addSubcommand(subcommand => subcommand
			.setName("delete-team")
			.setDescription("Deletes a team")
			.addStringOption(option => option
				.setName("team")
				.setDescription("Team name or ID")
				.setRequired(true)))
		.addSubcommand(subcommand => subcommand
			.setName("rename-team")
			.setDescription("Renames a team")
			.addStringOption(option => option
				.setName("team")
				.setDescription("Team name or ID")
				.setRequired(true))
			.addStringOption(option => option
				.setName("new-team-name")
				.setDescription("New name of team")
				.setRequired(true)))
		// .addSubcommand(subcommand => subcommand
		// 	.setName("move-to-breakout-rooms")
		// 	.setDescription("Moves everyone into their team voice channel")
		// 	.addStringOption(option => option
		// 		.setName("workshop")
		// 		.setDescription("Workshop name or code")
		// 		.setRequired(true)))
		.addSubcommand(subcommand => subcommand
			.setName("register-workshop")
			.setDescription("Creates a workshop")
			.addStringOption(option => option
				.setName("workshop-name")
				.setDescription("Workshop name")
				.setRequired(true))
			.addStringOption(option => option
				.setName("workshop-code")
				.setDescription("Workshop code")
				.setRequired(false)))
		.addSubcommand(subcommand => subcommand
			.setName("list-all-teams")
			.setDescription("Lists all teams and their ID"))
		.addSubcommand(subcommand => subcommand
			.setName("list-all-workshops")
			.setDescription("Lists all workshops and their code"))
		.addSubcommand(subcommand => subcommand
			.setName("delete-workshop")
			.setDescription("Deletes a workshop")
			.addStringOption(option => option
				.setName("workshop")
				.setDescription("Workshop name or code")
				.setRequired(true))
			.addBooleanOption(option => option
				.setName("remove-from-datastore")
				.setDescription("Whether to remove the workshop from the datastore (default: false)")
				.setRequired(false)))
		.addSubcommand(subcommand => subcommand
			.setName("create-support")
			.setDescription("Creates a support channel")
			.addStringOption(option => option
				.setName("type")
				.setDescription("Channel type")
				.setRequired(true)
				.addChoice("voice", "voice")
				.addChoice("text", "text")))
		.addSubcommand(subcommand => subcommand
			.setName("register-challenge")
			.setDescription("Creates a challenge")
			.addStringOption(option => option
				.setName("name")
				.setDescription("Challenge name")
				.setRequired(true))
			.addNumberOption(option => option
				.setName("points")
				.setDescription("Points on completion")
				.setRequired(true))
			.addStringOption(option => option
				.setName("workshop")
				.setDescription("Optional associated workshop name or code")
				.setRequired(false)))
		.addSubcommand(subcommand => subcommand
			.setName("give-team")
			.setDescription("Creates a submission and associates challenges")
			.addStringOption(option => option
				.setName("team")
				.setDescription("Team name or ID")
				.setRequired(true))
			.addStringOption(option => option
				.setName("challenges")
				.setDescription("Challenges' names or IDs (comma-separated)")
				.setRequired(true))
			.addStringOption(option => option
				.setName("content")
				.setDescription("Optional submission content")
				.setRequired(false)))
		.addSubcommand(subcommand => subcommand
			.setName("give-team-of")
			.setDescription("Creates a submission and associates challenges")
			.addUserOption(option => option
				.setName("member")
				.setDescription("Team member")
				.setRequired(true))
			.addStringOption(option => option
				.setName("challenges")
				.setDescription("Challenges' names or IDs (comma-separated)")
				.setRequired(true))
			.addStringOption(option => option
				.setName("content")
				.setDescription("Optional submission content")
				.setRequired(false)))
		.addSubcommand(subcommand => subcommand
			.setName("judge-submission")
			.setDescription("Judges a submission and associates challenges")
			.addStringOption(option => option
				.setName("submission")
				.setDescription("Submission ID")
				.setRequired(true))
			.addStringOption(option => option
				.setName("challenges")
				.setDescription("Challenges' names or IDs (comma-separated)")
				.setRequired(false)))
		.addSubcommand(subcommand => subcommand
			.setName("get-challenge")
			.setDescription("Gets information on a challenge")
			.addStringOption(option => option
				.setName("challenge")
				.setDescription("Challenge name or ID")
				.setRequired(true)))
		.addSubcommand(subcommand => subcommand
			.setName("get-submission")
			.setDescription("Gets information on a submission")
			.addStringOption(option => option
				.setName("submission")
				.setDescription("Submission ID")
				.setRequired(true)))
		.addSubcommand(subcommand => subcommand
			.setName("get-workshop")
			.setDescription("Gets information on a workshop")
			.addStringOption(option => option
				.setName("workshop")
				.setDescription("Workshop name or code")
				.setRequired(true)))
		.addSubcommand(subcommand => subcommand
			.setName("get-user")
			.setDescription("Gets information on a user")
			.addUserOption(option => option
				.setName("user")
				.setDescription("User")
				.setRequired(true)))
		.addSubcommand(subcommand => subcommand
			.setName("get-team")
			.setDescription("Gets information on a team")
			.addStringOption(option => option
				.setName("team")
				.setDescription("Team name or ID")
				.setRequired(true)))
		.addSubcommand(subcommand => subcommand
			.setName("delete-submission")
			.setDescription("Deletes a submission")
			.addStringOption(option => option
				.setName("submission")
				.setDescription("Submission ID")
				.setRequired(true)))
		.addSubcommand(subcommand => subcommand
			.setName("delete-challenge")
			.setDescription("Deletes a challenge")
			.addStringOption(option => option
				.setName("challenge")
				.setDescription("Challenge name or ID")
				.setRequired(true)))
		.addSubcommand(subcommand => subcommand
			.setName("create-role-buttons")
			.setDescription("Sends a message with buttons to add and remove roles")
			.addRoleOption(option => option
				.setName("role")
				.setDescription("The role to add / remove")
				.setRequired(true))),
	new SlashCommandBuilder()
		.setName("profile")
		.setDescription("Shows a summary of your profile"),
	new SlashCommandBuilder()
		.setName("team")
		.setDescription("Manage teams")
		.addSubcommand(subcommand => subcommand
			.setName("create")
			.setDescription("Creates a new team")
			.addStringOption(option => option
				.setName("team-name")
				.setDescription("Name of new team")
				.setRequired(true))
			.addUserOption(option => option
				.setName("member1")
				.setDescription("A fellow team mate")
				.setRequired(true))
			.addUserOption(option => option
				.setName("member2")
				.setDescription("Another team mate")
				.setRequired(false))
			.addUserOption(option => option
				.setName("member3")
				.setDescription("Yet another team mate")
				.setRequired(false)))
		.addSubcommand(subcommand => subcommand
			.setName("join")
			.setDescription("Joins a team")
			.addStringOption(option => option
				.setName("team")
				.setDescription("Team name or ID to join")
				.setRequired(true)))
		.addSubcommand(subcommand => subcommand
			.setName("rename")
			.setDescription("Renames your team")
			.addStringOption(option => option
				.setName("new-team-name")
				.setDescription("New name of team")
				.setRequired(true)))
		.addSubcommand(subcommand => subcommand
			.setName("leave")
			.setDescription("Leaves your team and destroys it if empty"))
		.addSubcommand(subcommand => subcommand
			.setName("join-random")
			.setDescription("Join a team that's free to join")),
	new SlashCommandBuilder()
		.setName("leaderboard")
		.setDescription("Shows the leaderboard with the top teams"),
	new SlashCommandBuilder()
		.setName("team-profile")
		.setDescription("Displays a team's profile")
		.addStringOption(option => option
			.setName("team")
			.setDescription("Team name or ID (defaults to your own)")
			.setRequired(false)),
	new SlashCommandBuilder()
		.setName("submit")
		.setDescription("Creates a submission to be judged by a leader")
		.addUserOption(option => option
			.setName("leader")
			.setDescription("The leader to notify")
			.setRequired(true))
		.addStringOption(option => option
			.setName("content")
			.setDescription("Submission content")
			.setRequired(true)),
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
