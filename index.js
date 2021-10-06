// Runs the VPCC-Bot

require("dotenv").config();

const fs = require("fs");
const { Client, Intents } = require("discord.js");
const client = new Client({ intents: [ Intents.FLAGS.GUILDS ] });

client.on("ready", () => {
	console.log(`Logged in as ${client.user.tag}`);
});

// key value store (will be upgraded to use replit's built in key value store later)
const store = {
	filename: "store.json",
	async set(key, value) {
		let raw;
		try {
			raw = await fs.promises.readFile(store.filename, "utf-8");
		} catch (e) {
			raw = "";
		}
		const mapping = raw ? JSON.parse(raw) : {};
		if (key.toString() !== "") {
			if (value.toString() === "") {
				mapping[key] = undefined;
			} else {
				try {
					const obj = JSON.parse(value);
					if (JSON.stringify(obj) == value)
						mapping[key] = obj;
					else
						mapping[key] = value;
				} catch (e) {
					mapping[key] = value;
				}
			}
		}
		await fs.promises.writeFile(store.filename, JSON.stringify(mapping));
	},
	async get(key) {
		let raw;
		try {
			raw = await fs.promises.readFile(store.filename, "utf-8");
		} catch (e) {
			raw = "";
		}
		const mapping = raw ? JSON.parse(raw) : {};
		if (key.toString() === "")
			return "";
		if (mapping[key] == null)
			return "";
		if (mapping[key] instanceof String)
			return mapping[key];
		return JSON.stringify(mapping[key]);
	},
};

// - Wrapper functions over JSON encoded values

async function get(store, resource) {
	const raw = await store.get(resource);
	if (raw === "") return {};
	return JSON.parse(raw);
}

async function set(store, resource, data) {
	if (Object.keys(data).length === 0) return await store.set(resource, "");
	return await store.set(resource, JSON.stringify(data));
}

async function modify(store, resource, callback) {
	const data = await get(store, resource);
	await callback(data);
	await set(store, resource, data);
}

// Helper function to remove an element from an array
function removeFromArray(array, element) {
	const index = array.lastIndexOf(element);
	if (index !== -1)
		array.splice(index, 1);
}

// Asynchronous version of Array.prototype.find
async function findPredicate(array, predicate) {
	for (let i = 0; i < array.length; i++) {
		if (await predicate(array[i], i, array)) {
			return array[i];
		}
	}
	return undefined;
}

// - JSON specific helper functions

async function getProperty(store, resource, property) {
	return (await get(store, resource))[property];
}

async function setProperty(store, resource, property, value) {
	return await modify(store, resource, data => {
		data[property] = value;
	});
}

async function getArray(store, resource, property) {
	return (await get(store, resource))[property] || [];
}

async function setArray(store, resource, property, value) {
	return await modify(store, resource, data => {
		if (value != null && value.length === 0)
			data[property] = undefined;
		else
			data[property] = value;
	});
}

async function modifyArray(store, resource, property, callback) {
	return await modify(store, resource, async data => {
		if (data[property] == null)
			data[property] = [];
		await callback(data[property]);
		if (data[property] != null && data[property].length === 0)
			data[property] = undefined;
	});
}

// - VPCC specific helper functions

// find userId with matching requirements
async function findUser(store, requirements) {
	const userIds = await getArray(store, "/users", "userIds");
	return await findPredicate(userIds, async userId => {
		for (const name in requirements) {
			if (requirements[name] === await getProperty(store, `/user/${userId}`, name)) {
				return true;
			}
		}
		return false;
	});
}

// find teamId with matching requirements
async function findTeam(store, requirements) {
	const teamIds = await getArray(store, "/teams", "teamIds");
	return await findPredicate(teamIds, async teamId => {
		for (const name in requirements) {
			if (requirements[name] === await getProperty(store, `/team/${teamId}`, name)) {
				return true;
			}
		}
		return false;
	});
}

async function createUser(store, userId, properties) {
	// create user with properties
	await modifyArray(store, `/users`, "userIds", array => array.push(userId));
	await modify(store, `/user/${userId}`, data => Object.assign(data, properties));
	return userId;
}

async function createTeam(guild, store, teamId, properties) {
	// create team with properties
	await modifyArray(store, `/teams`, "teamIds", array => array.push(teamId));
	await modify(store, `/team/${teamId}`, data => Object.assign(data, properties));
	// create team role
	const teamName = await getProperty(store, `/team/${teamId}`, "name");
	const role = await guild.roles.create({ name: `Team ${teamName}` });
	await setProperty(store, `/team/${teamId}`, "discordRoleId", role.id);
	return teamId;
}

async function joinTeam(guild, store, teamId, userId) {
	// join team
	await modifyArray(store, `/team/${teamId}`, "memberIds", array => array.push(userId));
	await setProperty(store, `/user/${userId}`, "teamId", teamId);
	// join team role
	const teamDiscordRoleId = await getProperty(store, `/team/${teamId}`, "discordRoleId");
	const discordUserId = await getProperty(store, `/user/${userId}`, "discordUserId");
	const discordMember = await guild.members.fetch(discordUserId);
	await discordMember.roles.add(teamDiscordRoleId);
}

async function renameTeam(guild, store, teamId, name) {
	// rename team
	await setProperty(store, `/team/${teamId}`, "name", name);
	// rename role
	const teamDiscordRoleId = await getProperty(store, `/team/${teamId}`, "discordRoleId");
	const role = await guild.roles.fetch(teamDiscordRoleId);
	await role.edit({ name: `Team ${name}` });
}

async function leaveTeam(guild, store, userId) {
	const teamId = await getProperty(store, `/user/${userId}`, "teamId");
	// leave team role
	const teamDiscordRoleId = await getProperty(store, `/team/${teamId}`, "discordRoleId");
	const discordUserId = await getProperty(store, `/user/${userId}`, "discordUserId");
	const discordMember = await guild.members.fetch(discordUserId);
	await discordMember.roles.remove(teamDiscordRoleId);
	// leave team
	await modifyArray(store, `/team/${teamId}`, "memberIds", array => removeFromArray(array, userId));
	await setProperty(store, `/user/${userId}`, "teamId", undefined);
}

async function destroyTeam(guild, store, teamId) {
	// remove team role
	const teamDiscordRoleId = await getProperty(store, `/team/${teamId}`, "discordRoleId");
	const role = await guild.roles.fetch(teamDiscordRoleId);
	await role.delete();
	// remove team
	await modifyArray(store, `/teams`, "teamIds", array => removeFromArray(array, teamId));
	await set(store, `/team/${teamId}`, {});
}

// Process slash commands
client.on("interactionCreate", async interaction => {
	if (!interaction.isCommand())
		return;

	const metadata = {
		timestamp: Date.now(),
		userDisplayName: `${interaction.user.username}#${interaction.user.discriminator}`,
		userId: interaction.user.id,
	};

	if (interaction.commandName === "ping") {
		await interaction.reply("pong");
		return;
	}

	if (interaction.commandName === "profile") {
		const type = interaction.options.getString("type") || "user";
		if (type === "user") {
			console.log([ "profile", "user", metadata ]);
			await interaction.deferReply();
			// find user and create if doesnt exist
			const userId = (
				await findUser(store, { discordUserId: interaction.user.id })
				|| await createUser(store, interaction.id, { discordUserId: interaction.user.id })
			);
			// get current team / points / medals
			const userData = await get(store, `/user/${userId}`);
			// get team
			const teamId = userData.teamId;
			const teamName = teamId && await getProperty(store, `/team/${teamId}`, "name");
			// get points this month
			const pointsThisMonth = [...userData.pointEvents || []].reduce((points, { type, deltaPoints }) => {
				if (type == "add") {
					return points + deltaPoints;
				}
				if (type == "clear") {
					return 0;
				}
			}, 0);
			// get number of medals
			const numMedals = [...userData.medalEvents || []].reduce((numMedals, { type }) => {
				if (type == "add") {
					return numMedals + 1;
				}
			}, 0);
			// build response
			const parts = [];
			parts.push(`Summary for ${metadata.userDisplayName}`);
			if (teamId)
				parts.push(`- Team: ${teamName}`);
			parts.push(`- Points this month: ${pointsThisMonth}`);
			parts.push(`- Medals: ${numMedals}`);
			// send response
			await interaction.editReply({ content: parts.join("\n"), allowedMentions: { parse: [] }});
			return;
		}
		if (type === "medals") {
			console.log([ "profile", "medals", metadata ]);
			await interaction.deferReply();
			await interaction.editReply(`haha lol ${type}`);
			return;
		}
		if (type == "points") {
			console.log([ "profile", "points", metadata ]);
			await interaction.deferReply();
			await interaction.editReply(`haha lol ${type}`);
			return;
		}
		if (type == "team") {
			console.log([ "profile", "team", metadata ]);
			await interaction.deferReply();
			await interaction.editReply(`haha lol ${type}`);
			return;
		}
	}

	if (interaction.commandName === "team") {
		const subcommandName = interaction.options.getSubcommand(true);
		if (subcommandName === "create") {
			const name = interaction.options.getString("name", true);
			console.log([ "team", "create", name, metadata ]);
			await interaction.deferReply();
			// fail if team exists
			if (await findTeam(store, { name }) != null) {
				await interaction.editReply(`Team called ${name} already exists`);
				return;
			}
			// fail if user exists and has a previous team
			let userId = await findUser(store, { discordUserId: interaction.user.id });
			if (userId != null) {
				const previousTeamId = await getProperty(store, `/user/${userId}`, "teamId");
				if (previousTeamId != null) {
					await interaction.editReply(`You are still in a team`);
					return;
				}
			}
			// create user if doesnt exist
			if (userId == null) {
				userId = await createUser(store, interaction.id, { discordUserId: interaction.user.id });
			}
			// create team
			const teamId = await createTeam(interaction.guild, store, interaction.id, { name });
			// join team
			await joinTeam(interaction.guild, store, teamId, userId);
			// reply to interaction
			await interaction.editReply(`Created and joined new team called ${name}`);
			return;
		}
		if (subcommandName === "join") {
			const name = interaction.options.getString("name", true);
			console.log([ "team", "join", name, metadata ]);
			// defer reply cuz it might take a while maybe
			await interaction.deferReply();
			// find user
			let targetUserId = await findUser(store, { discordUserId: interaction.user.id });
			// fail if user exists and has a previous team
			if (targetUserId != null) {
				let previousTeamId = await getProperty(store, `/user/${targetUserId}`, "teamId");
				if (previousTeamId != null) {
					await interaction.editReply(`You are still in a team`);
					return;
				}
			}
			// create user if necessary
			if (targetUserId == null) {
				targetUserId = await createUser(store, interaction.id, { discordUserId: interaction.user.id });
			}
			// fail if team doesnt exist
			const targetTeamId = await findTeam(store, { name });
			if (targetTeamId == null) {
				await interaction.editReply(`Team called ${name} doesn't exist`);
				return;
			}
			// join team
			await joinTeam(interaction.guild, store, targetTeamId, targetUserId);
			// reply to interaction
			await interaction.editReply(`Joined team called ${name}`);
			return;
		}
		if (subcommandName === "leave") {
			console.log([ "team", "leave", metadata ]);
			await interaction.deferReply();
			// fail if user doesnt exist
			const userId = await findUser(store, { discordUserId: interaction.user.id });
			if (userId == null) {
				await interaction.editReply(`You are not in a team`);
				return;
			}
			// fail if doesnt have a previous team
			const previousTeamId = await getProperty(store, `/user/${userId}`, "teamId");
			if (previousTeamId == null) {
				await interaction.editReply(`You are not in a team`);
				return;
			}
			// get team name
			const teamName = await getProperty(store, `/team/${previousTeamId}`, "name");
			// leave previous team
			await leaveTeam(interaction.guild, store, userId);
			// remove team if empty
			if ((await getArray(store, `/team/${previousTeamId}`, "memberIds")).length === 0) {
				await destroyTeam(interaction.guild, store, previousTeamId);
			}
			// reply to interaction
			await interaction.editReply(`Left team called ${teamName}`);
			return;
		}
		if (subcommandName === "rename") {
			const name = interaction.options.getString("name", true);
			console.log([ "team", "rename", name, metadata ]);
			await interaction.deferReply();
			// fail if user doesnt exist
			const userId = await findUser(store, { discordUserId: interaction.user.id });
			if (userId == null) {
				await interaction.editReply(`You are not in a team`);
				return;
			}
			// fail if team with same name exists
			if (await findTeam(store, { name }) != null) {
				await interaction.editReply(`Another team called ${name} exists`);
				return;
			}
			// fail if doesnt have a previous team
			const teamId = await getProperty(store, `/user/${userId}`, "teamId");
			if (teamId == null) {
				await interaction.editReply(`You are not in a team`);
				return;
			}
			// rename previous team
			await renameTeam(interaction.guild, store, teamId, name);
			// reply to interaction
			await interaction.editReply(`Renamed team to ${name}`);
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
