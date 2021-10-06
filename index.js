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
			// find user
			const userIds = await getArray(store, "/users", "userIds");
			let userId = await findPredicate(userIds, async userId => {
				return interaction.user.id === await getProperty(store, `/user/${userId}`, "discordUserId");
			});
			// create user if necessary
			if (userId == null) {
				userId = interaction.id;
				await modifyArray(store, `/users`, "userIds", array => array.push(userId));
				await setProperty(store, `/user/${userId}`, "discordUserId", interaction.user.id);
			}
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
		await interaction.reply(`haha lol ${type}`);
		return;
	}

	if (interaction.commandName === "team") {
		const subcommandName = interaction.options.getSubcommand(true);
		if (subcommandName === "create") {
			const name = interaction.options.getString("name", true);
			console.log([ "team", "create", name, metadata ]);
			await interaction.deferReply();
			// find team
			const teamIds = await getArray(store, `/teams`, "teamIds");
			let otherTeamId = await findPredicate(teamIds, async teamId => {
				return name === await getProperty(store, `/team/${teamId}`, "name");
			});
			// fail if team exists
			if (otherTeamId != null) {
				await interaction.editReply(`Team called ${name} already exists`);
				return;
			}
			// find user
			const userIds = await getArray(store, "/users", "userIds");
			let userId = await findPredicate(userIds, async userId => {
				return interaction.user.id === await getProperty(store, `/user/${userId}`, "discordUserId");
			});
			// fail if user exists and has a previous team
			if (userId != null) {
				let previousTeamId = await getProperty(store, `/user/${userId}`, "teamId");
				if (previousTeamId != null) {
					await interaction.editReply(`You are still in a team`);
					return;
				}
			}
			// create user if necessary
			if (userId == null) {
				userId = interaction.id;
				await modifyArray(store, `/users`, "userIds", array => array.push(userId));
				await setProperty(store, `/user/${userId}`, "discordUserId", interaction.user.id);
			}
			// create team
			const teamId = interaction.id;
			await modifyArray(store, `/teams`, "teamIds", array => array.push(teamId));
			await setProperty(store, `/team/${teamId}`, "name", name);
			// join team
			await modifyArray(store, `/team/${teamId}`, "memberIds", array => array.push(userId));
			await setProperty(store, `/user/${userId}`, "teamId", teamId);
			// create role if necessary
			let teamDiscordRoleId = await getProperty(store, `/team/${teamId}`, "discordRoleId");
			if (teamDiscordRoleId == null) {
				const role = await interaction.guild.roles.create({ name: `Team ${name}` })
				teamDiscordRoleId = role.id
				await setProperty(store, `/team/${teamId}`, "discordRoleId", role.id);
			}
			// join role
			const discordMember = await interaction.guild.members.fetch(interaction.user.id);
			await discordMember.roles.add(teamDiscordRoleId);
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
			const userIds = await getArray(store, "/users", "userIds");
			let targetUserId = await findPredicate(userIds, async userId => {
				return interaction.user.id === await getProperty(store, `/user/${userId}`, "discordUserId");
			});
			// leave previous team if exists and has one
			if (targetUserId != null) {
				let previousTeamId = await getProperty(store, `/user/${targetUserId}`, "teamId");
				if (previousTeamId != null) {
					await modifyArray(store, `/team/${previousTeamId}`, "memberIds", array => removeFromArray(array, targetUserId));
					await setProperty(store, `/user/${targetUserId}`, "teamId", undefined);
					// leave role
					const previousTeamDiscordRoleId = await getProperty(store, `/team/${previousTeamId}`, "discordRoleId");
					if (previousTeamDiscordRoleId != null) {
						const discordMember = await interaction.guild.members.fetch(interaction.user.id);
						await discordMember.roles.remove(previousTeamDiscordRoleId);
					}
					// remove team if empty
					const previousTeamMemberIds = await getArray(store, `/team/${previousTeamId}`, "memberIds");
					if (previousTeamDiscordRoleId != null && previousTeamMemberIds.length === 0) {
						await (await interaction.guild.roles.fetch(previousTeamDiscordRoleId)).delete();
						await modifyArray(store, `/teams`, "teamIds", array => removeFromArray(array, previousTeamId));
						await set(store, `/team/${previousTeamId}`, {});
					}
				}
			}
			// create user if necessary
			if (targetUserId == null) {
				targetUserId = interaction.id;
				await modifyArray(store, `/users`, "userIds", array => array.push(targetUserId));
				await setProperty(store, `/user/${targetUserId}`, "discordUserId", interaction.user.id);
			}
			// find team
			const teamIds = await getArray(store, "/teams", "teamIds");
			let targetTeamId = await findPredicate(teamIds, async teamId => {
				return name === await getProperty(store, `/team/${teamId}`, "name");
			});
			// create team if necessary
			let createdNewTeam = false;
			if (targetTeamId == null) {
				createdNewTeam = true;
				targetTeamId = interaction.id;
				await modifyArray(store, `/teams`, "teamIds", array => array.push(targetTeamId));
				await setProperty(store, `/team/${targetTeamId}`, "name", name);
			}
			// join team
			await modifyArray(store, `/team/${targetTeamId}`, "memberIds", array => array.push(targetUserId));
			await setProperty(store, `/user/${targetUserId}`, "teamId", targetTeamId);
			// create role if necessary
			let targetTeamDiscordRoleId = await getProperty(store, `/team/${targetTeamId}`, "discordRoleId");
			if (targetTeamDiscordRoleId == null) {
				const role = await interaction.guild.roles.create({ name: `Team ${name}` })
				targetTeamDiscordRoleId = role.id
				await setProperty(store, `/team/${targetTeamId}`, "discordRoleId", role.id);
			}
			// join role
			const discordMember = await interaction.guild.members.fetch(interaction.user.id);
			await discordMember.roles.add(targetTeamDiscordRoleId);
			// reply to interaction
			await interaction.editReply(createdNewTeam
				? `Created and joined new team called ${name}`
				: `Joined team called ${name}`
			);
			return;
		}
		if (subcommandName === "leave") {
			console.log([ "team", "leave", metadata ]);
			await interaction.deferReply();
			// get user
			const userIds = await getArray(store, `/users`, "userIds");
			const userId = await findPredicate(userIds, async userId => {
				return interaction.user.id === await getProperty(store, `/user/${userId}`, "discordUserId");
			});
			let previousTeamId;
			let teamName;
			// get previous team if user exists
			if (userId != null) {
				previousTeamId = await getProperty(store, `/user/${userId}`, "teamId");
				// leave previous team if has one
				if (previousTeamId != null) {
					teamName = await getProperty(store, `/team/${previousTeamId}`, "name");
					await modifyArray(store, `/team/${previousTeamId}`, "memberIds", array => removeFromArray(array, userId));
					await setProperty(store, `/user/${userId}`, "teamId", undefined);
					// leave role
					const previousTeamDiscordRoleId = await getProperty(store, `/team/${previousTeamId}`, "discordRoleId");
					if (previousTeamDiscordRoleId != null) {
						const discordMember = await interaction.guild.members.fetch(interaction.user.id);
						await discordMember.roles.remove(previousTeamDiscordRoleId);
					}
					// remove team if empty
					const previousTeamMemberIds = await getArray(store, `/team/${previousTeamId}`, "memberIds");
					if (previousTeamDiscordRoleId != null && previousTeamMemberIds.length === 0) {
						await (await interaction.guild.roles.fetch(previousTeamDiscordRoleId)).delete();
						await modifyArray(store, `/teams`, "teamIds", array => removeFromArray(array, previousTeamId));
						await set(store, `/team/${previousTeamId}`, {});
					}
				}
			}
			// reply to interaction
			await interaction.editReply((userId == null || previousTeamId == null)
				? `You are not in a team`
				: `Left team called ${teamName}`
			);
			return;
		}
		if (subcommandName === "rename") {
			const name = interaction.options.getString("name", true);
			console.log([ "team", "rename", name, metadata ]);
			await interaction.deferReply();
			// get user
			const userIds = await getArray(store, `/users`, "userIds");
			const userId = await findPredicate(userIds, async userId => {
				return interaction.user.id === await getProperty(store, `/user/${userId}`, "discordUserId");
			});
			// get previous team if user exists
			let teamId = undefined;
			if (userId != null) {
				teamId = await getProperty(store, `/user/${userId}`, "teamId");
				// rename previous team if has one
				if (teamId != null) {
					await setProperty(store, `/team/${teamId}`, "name", name);
				}
				// rename role if exists
				const teamDiscordRoleId = await getProperty(store, `/team/${teamId}`, "discordRoleId");
				if (teamDiscordRoleId != null) {
					await (await interaction.guild.roles.fetch(teamDiscordRoleId)).edit({ name: `Team ${name}` })
				}
			}
			// reply to interaction
			await interaction.editReply((userId == null || teamId == null)
				? `You are not in a team`
				: `Renamed team to ${name}`
			);
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
