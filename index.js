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
					mapping[key] = JSON.parse(value);
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

async function getEvents(store, resource) {
	const raw = await store.get(resource);
	if (raw === "") return [];
	return JSON.parse(raw);
}

async function setEvents(store, resource, events) {
	if (events.length === 0) return await store.set(resource, "");
	return await store.set(resource, JSON.stringify(events));
}

async function appendEvent(store, resource, key, value) {
	const events = await getEvents(store, resource);
	events.push({ timestamp: Date.now(), key, value })
	await setEvents(store, resource, events);
}

async function getUserIds(store) {
	const userIds = [];
	for (const event of await getEvents(store, "/users")) {
		if (event.key === "users") {
			if (event.value.type === "add") {
				userIds.push(event.value.userId);
			} else if (event.value.type == "remove") {
				const index = userIds.lastIndexOf(event.value.userId);
				if (index !== -1)
					userIds.splice(index, 1);
			}
		}
	}
	return userIds;
}

async function getTeamIds(store) {
	const teamIds = [];
	for (const event of await getEvents(store, "/teams")) {
		if (event.key === "teams") {
			if (event.value.type === "add") {
				teamIds.push(event.value.teamId);
			} else if (event.value.type == "remove") {
				const index = teamIds.lastIndexOf(event.value.teamId);
				if (index !== -1)
					teamIds.splice(index, 1);
			}
		}
	}
	return teamIds;
}

async function findPredicate(array, predicate) {
	for (let i = 0; i < array.length; i++) {
		if (await predicate(array[i], i, array)) {
			return array[i];
		}
	}
	return undefined;
}

client.on("interactionCreate", async interaction => {
	if (!interaction.isCommand())
		return;

	if (interaction.commandName === "ping") {
		await interaction.reply("pong");
		console.log(JSON.stringify(store.data, null, 2));
		return;
	}

	if (interaction.commandName === "profile") {
		const type = interaction.options.getString("type") || "user";
		await interaction.reply(`haha lol ${type}`);
		return;
	}

	if (interaction.commandName === "team") {
		const subcommandName = interaction.options.getSubcommand(true);
		const displayName = `${interaction.user.username}#${interaction.user.discriminator}`;
		if (subcommandName === "join") {
			// defer reply cuz it might take a while maybe
			await interaction.deferReply();
			const name = interaction.options.getString("name", true);
			// create team if necessary
			const teamIds = await getTeamIds(store);
			let targetTeamId = await findPredicate(teamIds, async teamId => {
				return name === [...await getEvents(store, `/team/${teamId}`)]
					.filter(({ key }) => key === "name")
					.reduce((_, { value: { name } }) => name, null);
			})
			let createdNewTeam = false;
			if (targetTeamId == null) {
				createdNewTeam = true;
				targetTeamId = interaction.id;
				await appendEvent(store, `/teams`, "teams", {
					type: "add",
					teamId: targetTeamId,
					reason: `created by ${displayName}`,
				});
				await appendEvent(store, `/team/${targetTeamId}`, "name", {
					name: name,
					reason: `created by ${displayName}`,
				});
			}
			// create user if necessary
			const userIds = await getUserIds(store);
			let targetUserId = await findPredicate(userIds, async userId => {
				return interaction.user.id === [...await getEvents(store, `/user/${userId}`)]
					.filter(({ key }) => key === "discordUser")
					.reduce((_, { value: { discordUserId } }) => discordUserId, null);
			})
			if (targetUserId == null) {
				targetUserId = interaction.id;
				await appendEvent(store, `/users`, "users", {
					type: "add",
					userId: targetUserId,
					reason: `created by ${displayName}`,
				});
				await appendEvent(store, `/user/${targetUserId}`, "discordUser", {
					discordUserId: interaction.user.id,
					reason: `created by ${displayName}`,
				});
			}
			// leave previous team if has one
			let previousTeamId = [...await getEvents(store, `/user/${targetUserId}`)]
				.filter(({ key }) => key === "team")
				.reduce((_, { value: { teamId } }) => teamId, null);
			if (previousTeamId != null) {
				await appendEvent(store, `/team/${previousTeamId}`, "members", {
					type: "remove",
					userId: targetUserId,
					reason: `changing teams to ${targetTeamId} by ${displayName}`,
				});
				await appendEvent(store, `/user/${targetUserId}`, "team", {
					teamId: null,
					reason: `changing teams to ${targetTeamId} by ${displayName}`,
				});
				// leave role
				const previousTeamDiscordRoleId = [...await getEvents(store, `/team/${previousTeamId}`)]
					.filter(({ key }) => key === "discordRole")
					.reduce((_, { value: { discordRoleId } }) => discordRoleId, null);
				if (previousTeamDiscordRoleId != null) {
					const discordMember = await interaction.guild.members.fetch(interaction.user.id);
					await discordMember.roles.remove(previousTeamDiscordRoleId);
				}
				// remove role if empty
				const previousTeamMemberIds = [...await getEvents(store, `/team/${previousTeamId}`)]
					.filter(({ key }) => key === "members")
					.reduce((memberIds, { value: { type, userId } }) => {
						if (type === "add") {
							memberIds.push(userId);
						} else if (type == "remove") {
							const index = memberIds.lastIndexOf(userId);
							if (index !== -1)
								memberIds.splice(index, 1);
						}
						return memberIds;
				}, []);
				if (previousTeamDiscordRoleId != null && previousTeamMemberIds.length === 0) {
					await (await interaction.guild.roles.fetch(previousTeamDiscordRoleId)).delete();
					await appendEvent(store, `/teams`, "teams", {
						type: "remove",
						teamId: previousTeamId,
						reason: `last member ${displayName} left`,
					});
				}
			}
			// join team
			await appendEvent(store, `/team/${targetTeamId}`, "members", {
				type: "add",
				userId: targetUserId,
				reason: (previousTeamId == null)
					? `joining new team by ${displayName}`
					: `changing teams from ${previousTeamId} by ${displayName}`,
			});
			await appendEvent(store, `/user/${targetUserId}`, "team", {
				teamId: targetTeamId,
				reason: (previousTeamId == null)
					? `joining new team by ${displayName}`
					: `changing teams from ${previousTeamId} by ${displayName}`,
			});
			// create role if necessary
			let targetTeamDiscordRoleId = [...await getEvents(store, `/team/${targetTeamId}`)]
				.filter(({ key }) => key === "discordRole")
				.reduce((_, { value: { discordRoleId } }) => discordRoleId, null);
			if (targetTeamDiscordRoleId == null) {
				const role = await interaction.guild.roles.create({ name: `Team ${name}` })
				targetTeamDiscordRoleId = role.id
				await appendEvent(store, `/team/${targetTeamId}`, "discordRole", {
					discordRoleId: role.id,
					reason: `created by ${displayName}`,
				});
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
			await interaction.deferReply();
			// get user
			const userIds = await getUserIds(store);
			const userId = await findPredicate(userIds, async userId => {
				return interaction.user.id === [...await getEvents(store, `/user/${userId}`)]
					.filter(({ key }) => key === "discordUser")
					.reduce((_, { value: { discordUserId } }) => discordUserId, null);
			})
			let previousTeamId;
			let teamName;
			// get previous team if user exists
			if (userId != null) {
				previousTeamId = [...await getEvents(store, `/user/${userId}`)]
					.filter(({ key }) => key === "team")
					.reduce((_, { value: { teamId } }) => teamId, null);
				// leave previous team if has one
				if (previousTeamId != null) {
					teamName = [...await getEvents(store, `/team/${previousTeamId}`)]
						.filter(({ key }) => key === "name")
						.reduce((_, { value: { name } }) => name, null);
					await appendEvent(store, `/team/${previousTeamId}`, "members", {
						type: "remove",
						userId: userId,
						reason: `leaving team by ${displayName}`,
					});
					await appendEvent(store, `/user/${userId}`, "team", {
						teamId: null,
						reason: `leaving team by ${displayName}`,
					});
					// leave role
					const previousTeamDiscordRoleId = [...await getEvents(store, `/team/${previousTeamId}`)]
						.filter(({ key }) => key === "discordRole")
						.reduce((_, { value: { discordRoleId } }) => discordRoleId, null);
					if (previousTeamDiscordRoleId != null) {
						const discordMember = await interaction.guild.members.fetch(interaction.user.id);
						await discordMember.roles.remove(previousTeamDiscordRoleId);
					}
					// remove role if empty
					const previousTeamMemberIds = [...await getEvents(store, `/team/${previousTeamId}`)]
						.filter(({ key }) => key === "members")
						.reduce((memberIds, { value: { type, userId } }) => {
							if (type === "add") {
								memberIds.push(userId);
							} else if (type == "remove") {
								const index = memberIds.lastIndexOf(userId);
								if (index !== -1)
									memberIds.splice(index, 1);
							}
							return memberIds;
					}, []);
					if (previousTeamDiscordRoleId != null && previousTeamMemberIds.length === 0) {
						await (await interaction.guild.roles.fetch(previousTeamDiscordRoleId)).delete();
						await appendEvent(store, `/teams`, "teams", {
							type: "remove",
							teamId: previousTeamId,
							reason: `last member ${displayName} left`,
						});
						await appendEvent(store, `/team/${previousTeamId}`, "discordRole", {
							discordRoleId: null,
							reason: `last member ${displayName} left`,
						});
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
			await interaction.deferReply();
			const name = interaction.options.getString("name", true);
			// get user
			const userIds = await getUserIds(store);
			const userId = await findPredicate(userIds, async userId => {
				return interaction.user.id === [...await getEvents(store, `/user/${userId}`)]
					.filter(({ key }) => key === "discordUser")
					.reduce((_, { value: { discordUserId } }) => discordUserId, null);
			})
			// get previous team if user exists
			let teamId = undefined;
			if (userId != null) {
				teamId = [...await getEvents(store, `/user/${userId}`)]
					.filter(({ key }) => key === "team")
					.reduce((_, { value: { teamId } }) => teamId, null);
				// rename previous team if has one
				if (teamId != null) {
					await appendEvent(store, `/team/${teamId}`, "name", {
						name: name,
						reason: `renamed by ${displayName}`,
					});
				}
				// rename role if exists
				const teamDiscordRoleId = [...await getEvents(store, `/team/${teamId}`)]
					.filter(({ key }) => key === "discordRole")
					.reduce((_, { value: { discordRoleId } }) => discordRoleId, null);
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
